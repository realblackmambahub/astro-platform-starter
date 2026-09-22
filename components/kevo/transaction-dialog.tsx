'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFinanceTable } from '@/hooks/use-finance-table'
import { createTransaction, updateTransaction, type TransactionRecord } from '@/services/transactions-repository'

export type TransactionFormValue = Pick<TransactionRecord, 'id' | 'description' | 'amount' | 'type' | 'transaction_date' | 'category_id' | 'account_id' | 'notes'> | null

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: TransactionFormValue
  onSaved: () => void
}) {
  const categories = useFinanceTable('categories')
  const accounts = useFinanceTable('accounts')

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setType(transaction?.type ?? 'expense')
    setDescription(transaction?.description ?? '')
    setAmount(transaction ? String(Math.abs(Number(transaction.amount))) : '')
    setDate(transaction?.transaction_date?.slice(0, 10) ?? todayISO())
    setCategoryId(transaction?.category_id ?? '')
    setAccountId(transaction?.account_id ?? '')
    setNotes(transaction?.notes ?? '')
    setError('')
  }, [open, transaction])

  const isEdit = Boolean(transaction?.id)

  const submit = async () => {
    if (!description.trim()) return setError('Informe uma descrição.')
    const numeric = Number(amount.replace(',', '.'))
    if (!Number.isFinite(numeric) || numeric <= 0) return setError('Informe um valor válido maior que zero.')
    if (!date) return setError('Informe a data.')
    setSaving(true)
    setError('')
    try {
      const payload = {
        description: description.trim(),
        amount: numeric,
        type,
        transaction_date: date,
        category_id: categoryId || null,
        account_id: accountId || null,
        notes: notes.trim() || null,
        source: transaction?.id ? undefined : 'Dashboard',
      }
      if (isEdit && transaction?.id) {
        await updateTransaction(transaction.id, payload as never)
      } else {
        await createTransaction({ ...payload, source: 'Dashboard' } as never)
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar esta movimentação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar movimentação' : 'Nova movimentação'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Atualize os dados desta movimentação real.' : 'Registre uma movimentação real no seu ledger.'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${type === 'expense' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${type === 'income' ? 'border-chart-2/40 bg-chart-2/10 text-chart-2' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              Receita
            </button>
          </div>

          <div>
            <Label htmlFor="tx-description">Descrição</Label>
            <Input id="tx-description" className="mt-1.5" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Mercado, Salário…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tx-amount">Valor (R$)</Label>
              <Input id="tx-amount" className="mt-1.5" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label htmlFor="tx-date">Data</Label>
              <Input id="tx-date" className="mt-1.5" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? '')}>
                <SelectTrigger className="mt-1.5 w-full"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.data.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma categoria criada</div>
                  ) : (
                    categories.data.map((row: any) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={(value) => setAccountId(value ?? '')}>
                <SelectTrigger className="mt-1.5 w-full"><SelectValue placeholder="Sem conta" /></SelectTrigger>
                <SelectContent>
                  {accounts.data.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma conta criada</div>
                  ) : (
                    accounts.data.map((row: any) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tx-notes">Notas (opcional)</Label>
            <Input id="tx-notes" className="mt-1.5" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observações internas" />
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar movimentação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
