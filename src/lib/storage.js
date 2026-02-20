import { useState, useEffect } from 'react'

const STORAGE_KEY = 'german_tax_tracker_v2'

function getStoredData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : { funds: [], incomes: [], sales: [] }
  } catch {
    return { funds: [], incomes: [], sales: [] }
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useStorage() {
  const [data, setData] = useState(getStoredData)

  useEffect(() => {
    saveData(data)
  }, [data])

  const addFund = (fund) => {
    const newFund = { ...fund, id: fund.id || `fund_${Date.now()}` }
    setData((prev) => ({ ...prev, funds: [...prev.funds, newFund] }))
    return newFund
  }

  const updateFund = (fund) => {
    setData((prev) => ({
      ...prev,
      funds: prev.funds.map((f) => (f.id === fund.id ? fund : f)),
    }))
  }

  const deleteFund = (fundId) => {
    setData((prev) => ({
      ...prev,
      funds: prev.funds.filter((f) => f.id !== fundId),
    }))
  }

  const addIncome = (income) => {
    const newIncome = { ...income, id: income.id || `income_${Date.now()}` }
    setData((prev) => ({ ...prev, incomes: [...prev.incomes, newIncome] }))
    return newIncome
  }

  const updateIncome = (income) => {
    setData((prev) => ({
      ...prev,
      incomes: prev.incomes.map((i) => (i.id === income.id ? income : i)),
    }))
  }

  const deleteIncome = (incomeId) => {
    setData((prev) => ({
      ...prev,
      incomes: prev.incomes.filter((i) => i.id !== incomeId),
    }))
  }

  const addSale = (sale) => {
    const newSale = { ...sale, id: sale.id || `sale_${Date.now()}` }
    setData((prev) => ({ ...prev, sales: [...prev.sales, newSale] }))
    return newSale
  }

  const updateSale = (sale) => {
    setData((prev) => ({
      ...prev,
      sales: prev.sales.map((s) => (s.id === sale.id ? sale : s)),
    }))
  }

  const deleteSale = (saleId) => {
    setData((prev) => ({
      ...prev,
      sales: prev.sales.filter((s) => s.id !== saleId),
    }))
  }

  return {
    funds: data.funds,
    incomes: data.incomes,
    sales: data.sales,
    addFund,
    updateFund,
    deleteFund,
    addIncome,
    updateIncome,
    deleteIncome,
    addSale,
    updateSale,
    deleteSale,
  }
}
