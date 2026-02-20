import { useState, useEffect } from 'react'

import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStorage } from '@/lib/storage'
import {
  calculateVorabpauschale,
  calculateVorabpauschaleMultiple,
  calculateTax,
  getDeadline,
  formatCurrency,
  FUND_TYPE_LABELS,
  TEILFREISTELLUNG,
} from '@/lib/tax'

const currentYear = new Date().getFullYear()
const defaultFilingYear = currentYear - 1 // You file for last year
const years = [2023, 2024, 2025, 2026]

export default function App() {
  const [filingYear, setFilingYear] = useState(defaultFilingYear)
  const dataYear = filingYear - 1

  const { funds, incomes, sales, addFund, updateFund, deleteFund, addIncome, updateIncome, deleteIncome, addSale, deleteSale } = useStorage()

  // Modals
  const [fundModalOpen, setFundModalOpen] = useState(false)
  const [incomeModalOpen, setIncomeModalOpen] = useState(false)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [stockSaleModalOpen, setStockSaleModalOpen] = useState(false)
  const [bondSaleModalOpen, setBondSaleModalOpen] = useState(false)
  const [derivativeModalOpen, setDerivativeModalOpen] = useState(false)
  const [editingFund, setEditingFund] = useState(null)
  const [editingIncome, setEditingIncome] = useState(null)
  const [editingStockSale, setEditingStockSale] = useState(null)
  const [editingBondSale, setEditingBondSale] = useState(null)
  const [editingDerivative, setEditingDerivative] = useState(null)

  // Close all modals when filing year changes
  useEffect(() => {
    setFundModalOpen(false)
    setIncomeModalOpen(false)
    setSaleModalOpen(false)
    setStockSaleModalOpen(false)
    setBondSaleModalOpen(false)
    setDerivativeModalOpen(false)
  }, [filingYear])

  // ELSTER expandable state
  const [expandedElster, setExpandedElster] = useState({})
  const toggleElster = (key) => {
    setExpandedElster(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Fund form state
  const [fundName, setFundName] = useState('')
  const [fundType, setFundType] = useState('aktienfonds')
  const [valueStart, setValueStart] = useState('')
  const [valueEnd, setValueEnd] = useState('')
  const [distributions, setDistributions] = useState('0')
  // Acquisition type: 'before' = owned before year, 'single' = one mid-year purchase, 'multiple' = savings plan or multiple buys
  const [acquisitionType, setAcquisitionType] = useState('before')
  const [singlePurchaseMonth, setSinglePurchaseMonth] = useState('1')
  const [singlePurchaseAmount, setSinglePurchaseAmount] = useState('')
  const [multiplePurchases, setMultiplePurchases] = useState([]) // [{month: '2', amount: '1000'}, ...]

  // Income form state
  const [incomeType, setIncomeType] = useState('interest')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeDescription, setIncomeDescription] = useState('')
  const [incomeWithholding, setIncomeWithholding] = useState('0')

  // Stock sale form state
  const [stockDescription, setStockDescription] = useState('')
  const [stockCostBasis, setStockCostBasis] = useState('')
  const [stockProceeds, setStockProceeds] = useState('')

  // Bond sale form state
  const [bondDescription, setBondDescription] = useState('')
  const [bondCostBasis, setBondCostBasis] = useState('')
  const [bondProceeds, setBondProceeds] = useState('')

  // Derivative form state
  const [derivativeDescription, setDerivativeDescription] = useState('')
  const [derivativeSubtype, setDerivativeSubtype] = useState('option_gain')
  const [derivativeAmount, setDerivativeAmount] = useState('')

  // Sale wizard state
  const [saleStep, setSaleStep] = useState(1)
  const [saleFundId, setSaleFundId] = useState('')
  const [salePurchaseYear, setSalePurchaseYear] = useState('')
  const [saleVpYearData, setSaleVpYearData] = useState({})
  // Structure: { 2019: { valueStart: '', valueEnd: '', distributions: '', notResident: false }, ... }
  const [saleIsFirstSale, setSaleIsFirstSale] = useState(null) // null = not answered, true/false
  const [saleVpExpanded, setSaleVpExpanded] = useState(false) // For Step 3: expand to edit pre-filled data
  const [salePreviousVpUsed, setSalePreviousVpUsed] = useState('0')
  const [saleCostBasis, setSaleCostBasis] = useState('')
  const [saleProceeds, setSaleProceeds] = useState('')

  // Years when VP was actually charged (positive Basiszins)
  // 2018: 0.87%, 2019: 0.52%, 2020: 0.07%, 2021-2022: negative (no VP), 2023: 2.55%, 2024: 2.29%, 2025: 2.53%, 2026: 3.20%
  const vpYears = [2018, 2019, 2020, 2023, 2024, 2025, 2026]

  // Pre-fill sale wizard VP data when fund is selected
  const selectedSaleFund = funds.find(f => f.id === saleFundId)
  useEffect(() => {
    if (!saleFundId) return
    const fund = funds.find(f => f.id === saleFundId)
    if (!fund?.snapshots) return

    // Convert fund snapshots to wizard format
    const prefilled = {}
    for (const year of vpYears) {
      const snapshot = fund.snapshots[year]
      if (snapshot) {
        prefilled[year] = {
          valueStart: snapshot.valueStart?.toString() || '',
          valueEnd: snapshot.valueEnd?.toString() || '',
          distributions: snapshot.distributions?.toString() || '',
          notResident: false
        }
      }
    }

    // Only set if we have prefilled data and current data is empty
    setSaleVpYearData(prev => {
      const hasExistingData = Object.keys(prev).some(y =>
        prev[y]?.valueStart || prev[y]?.valueEnd || prev[y]?.distributions
      )
      if (hasExistingData) return prev  // Don't overwrite user edits
      return prefilled
    })

  }, [saleFundId, funds])

  // Calculations
  const fundVPs = funds.map((fund) => {
    const snapshot = fund.snapshots?.[dataYear]
    if (!snapshot) return { fund, vp: null }

    let vp
    if (snapshot.acquisitionType === 'multiple' && snapshot.purchases) {
      vp = calculateVorabpauschaleMultiple(
        snapshot.purchases,
        snapshot.distributions,
        fund.type,
        dataYear
      )
    } else if (snapshot.acquisitionType === 'single' && snapshot.singlePurchase) {
      vp = calculateVorabpauschaleMultiple(
        [snapshot.singlePurchase],
        snapshot.distributions,
        fund.type,
        dataYear
      )
    } else {
      // 'before' or old format with acquiredMonth
      vp = calculateVorabpauschale(
        snapshot.valueStart,
        snapshot.valueEnd,
        snapshot.distributions,
        fund.type,
        dataYear,
        snapshot.acquiredMonth
      )
    }

    return { fund, vp, snapshot }
  })

  const totalVP = fundVPs.reduce((sum, { vp }) => sum + (vp?.vopiBeforeExemption || 0), 0)

  const yearIncomes = incomes.filter((i) => i.year === filingYear)
  const yearSales = sales.filter((s) => s.year === filingYear)

  const interestItems = yearIncomes.filter((i) => i.type === 'interest')
  const dividendItems = yearIncomes.filter((i) => i.type === 'dividends')
  const stockSaleItems = yearIncomes.filter((i) => i.type === 'stock_sale')
  const bondSaleItems = yearIncomes.filter((i) => i.type === 'bond_sale')
  const derivativeItems = yearIncomes.filter((i) => i.type === 'derivative')

  const totalInterest = interestItems.reduce((sum, i) => sum + i.amount, 0)
  const totalDividends = dividendItems.reduce((sum, i) => sum + i.amount, 0)
  const totalStockGains = stockSaleItems.reduce((sum, i) => sum + ((i.proceeds || 0) - (i.costBasis || 0)), 0)
  const totalBondGains = bondSaleItems.reduce((sum, i) => sum + ((i.proceeds || 0) - (i.costBasis || 0)), 0)
  const totalDerivatives = derivativeItems.reduce((sum, i) => sum + (i.amount || 0), 0)
  const totalEtfSaleGains = yearSales.reduce((sum, s) => sum + Math.max(0, s.proceeds - s.costBasis), 0)
  const totalWithholding = yearIncomes.reduce((sum, i) => sum + (i.withholdingTax || 0), 0)

  // Zeile 19: Total of all foreign capital gains (excluding ETF sales which go to KAP-INV)
  const totalZeile19 = totalInterest + totalDividends + totalStockGains + totalBondGains + totalDerivatives
  // Zeile 20: Stock sale gains only (subset of Zeile 19)
  const totalZeile20 = Math.max(0, totalStockGains)
  // Total capital gains shown in the card (includes ETF sales for display)
  const totalCapitalGains = totalInterest + totalDividends + totalEtfSaleGains + totalStockGains + totalBondGains + totalDerivatives

  // ELSTER values
  const distByType = { aktienfonds: 0, mischfonds: 0, immobilienfonds: 0, auslands_immobilienfonds: 0, sonstige: 0 }
  const vpByType = { aktienfonds: 0, mischfonds: 0, immobilienfonds: 0, auslands_immobilienfonds: 0, sonstige: 0 }
  fundVPs.forEach(({ fund, vp, snapshot }) => {
    if (snapshot) distByType[fund.type] += snapshot.distributions || 0
    if (vp) vpByType[fund.type] += vp.vopiBeforeExemption
  })
  // KAP-INV Zeilen 14-28: Sale gains by fund type (vor Teilfreistellung)
  // Per § 19 Abs. 1 InvStG: Gain = Proceeds - CostBasis - VP credit (vor TFS)
  const saleGainByType = { aktienfonds: 0, mischfonds: 0, immobilienfonds: 0, auslands_immobilienfonds: 0, sonstige: 0 }
  yearSales.forEach((sale) => {
    const gain = (sale.proceeds || 0) - (sale.costBasis || 0) - (sale.vpCredit || 0)
    if (sale.fundType) saleGainByType[sale.fundType] += gain
  })

  
  // Helper functions for multiple purchases
  const addPurchase = () => {
    setMultiplePurchases(prev => [...prev, { month: '1', amount: '' }])
  }

  const updatePurchase = (index, field, value) => {
    setMultiplePurchases(prev => prev.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    ))
  }

  const removePurchase = (index) => {
    setMultiplePurchases(prev => prev.filter((_, i) => i !== index))
  }

  // Fund modal handlers
  const openFundModal = (fund = null) => {
    if (fund) {
      setEditingFund(fund)
      setFundName(fund.name)
      setFundType(fund.type)
      const snapshot = fund.snapshots?.[dataYear]

      // Handle backwards compatibility and new formats
      if (snapshot?.acquiredMonth !== undefined && !snapshot.acquisitionType) {
        // Old format - migrate
        if (!snapshot.acquiredMonth || snapshot.acquiredMonth === 'before') {
          setAcquisitionType('before')
          setValueStart(snapshot.valueStart?.toString() || '')
        } else {
          // Old format with mid-year purchase - convert to multiple
          setAcquisitionType('multiple')
          setMultiplePurchases([{
            month: snapshot.acquiredMonth.toString(),
            amount: snapshot.valueStart?.toString() || ''
          }])
        }
        setMultiplePurchases([])
      } else if (snapshot?.acquisitionType) {
        // New format
        setAcquisitionType(snapshot.acquisitionType)
        if (snapshot.acquisitionType === 'before') {
          setValueStart(snapshot.valueStart?.toString() || '')
          setMultiplePurchases([])
        } else if (snapshot.acquisitionType === 'single') {
          // Legacy single purchase — convert to multiple format
          setAcquisitionType('multiple')
          setMultiplePurchases([{
            month: snapshot.singlePurchase?.month?.toString() || '1',
            amount: snapshot.singlePurchase?.amount?.toString() || ''
          }])
        } else if (snapshot.acquisitionType === 'multiple') {
          setMultiplePurchases(snapshot.purchases?.map(p => ({
            month: p.month.toString(),
            amount: p.amount.toString(),
          })) || [])
        }
      } else {
        // No snapshot for current dataYear — try to auto-populate from prior year
        const priorYears = Object.keys(fund.snapshots || {}).map(Number).filter(y => y < dataYear).sort((a, b) => b - a)
        const priorYear = priorYears[0]
        const priorSnapshot = priorYear ? fund.snapshots[priorYear] : null

        setAcquisitionType('before')
        setValueStart(priorSnapshot?.valueEnd?.toString() || '')
        setMultiplePurchases([])
      }

      setValueEnd(snapshot?.valueEnd?.toString() || '')
      setDistributions(snapshot?.distributions?.toString() || '0')
    } else {
      setEditingFund(null)
      setFundName('')
      setFundType('aktienfonds')
      setValueStart('')
      setValueEnd('')
      setDistributions('0')
      setAcquisitionType('before')
      setSinglePurchaseMonth('1')
      setSinglePurchaseAmount('')
      setMultiplePurchases([])
    }
    setFundModalOpen(true)
  }

  const saveFund = () => {
    if (!fundName.trim()) return

    let snapshot = {
      valueEnd: parseFloat(valueEnd) || 0,
      distributions: parseFloat(distributions) || 0,
      acquisitionType,
    }

    if (acquisitionType === 'before') {
      snapshot.valueStart = parseFloat(valueStart) || 0
    } else if (acquisitionType === 'multiple') {
      snapshot.purchases = multiplePurchases
        .map(p => ({
          month: parseInt(p.month),
          amount: parseFloat(p.amount) || 0,
        }))
        .filter(p => p.amount > 0)
    }

    if (editingFund) {
      updateFund({
        ...editingFund,
        name: fundName,
        type: fundType,
        snapshots: { ...editingFund.snapshots, [dataYear]: snapshot },
      })
    } else {
      addFund({
        name: fundName,
        type: fundType,
        snapshots: { [dataYear]: snapshot },
      })
    }
    setFundModalOpen(false)
  }

  const handleDeleteFund = () => {
    if (editingFund) {
      deleteFund(editingFund.id)
      setFundModalOpen(false)
    }
  }

  // Income modal handlers
  const openIncomeModal = (income = null, presetType = null) => {
    if (income) {
      setEditingIncome(income)
      setIncomeType(income.type)
      setIncomeAmount(income.amount.toString())
      setIncomeDescription(income.description || '')
      setIncomeWithholding((income.withholdingTax || 0).toString())
    } else {
      setEditingIncome(null)
      setIncomeType(presetType || 'interest')
      setIncomeAmount('')
      setIncomeDescription('')
      setIncomeWithholding('0')
    }
    setIncomeModalOpen(true)
  }

  const saveIncome = () => {
    const amount = parseFloat(incomeAmount) || 0
    if (amount <= 0) return

    const income = {
      type: incomeType,
      amount,
      description: incomeDescription,
      withholdingTax: parseFloat(incomeWithholding) || 0,
      year: filingYear,
    }

    if (editingIncome) {
      updateIncome({ ...editingIncome, ...income })
    } else {
      addIncome(income)
    }
    setIncomeModalOpen(false)
  }

  const handleDeleteIncome = () => {
    if (editingIncome) {
      deleteIncome(editingIncome.id)
      setIncomeModalOpen(false)
    }
  }

  // Stock sale modal handlers
  const openStockSaleModal = (item = null) => {
    if (item) {
      setEditingStockSale(item)
      setStockDescription(item.description || '')
      setStockCostBasis((item.costBasis || 0).toString())
      setStockProceeds((item.proceeds || 0).toString())
    } else {
      setEditingStockSale(null)
      setStockDescription('')
      setStockCostBasis('')
      setStockProceeds('')
    }
    setStockSaleModalOpen(true)
  }

  const saveStockSale = () => {
    const costBasis = parseFloat(stockCostBasis) || 0
    const proceeds = parseFloat(stockProceeds) || 0
    if (!stockDescription.trim()) return

    const item = {
      type: 'stock_sale',
      description: stockDescription,
      costBasis,
      proceeds,
      year: filingYear,
    }

    if (editingStockSale) {
      updateIncome({ ...editingStockSale, ...item })
    } else {
      addIncome(item)
    }
    setStockSaleModalOpen(false)
  }

  const handleDeleteStockSale = () => {
    if (editingStockSale) {
      deleteIncome(editingStockSale.id)
      setStockSaleModalOpen(false)
    }
  }

  // Bond sale modal handlers
  const openBondSaleModal = (item = null) => {
    if (item) {
      setEditingBondSale(item)
      setBondDescription(item.description || '')
      setBondCostBasis((item.costBasis || 0).toString())
      setBondProceeds((item.proceeds || 0).toString())
    } else {
      setEditingBondSale(null)
      setBondDescription('')
      setBondCostBasis('')
      setBondProceeds('')
    }
    setBondSaleModalOpen(true)
  }

  const saveBondSale = () => {
    const costBasis = parseFloat(bondCostBasis) || 0
    const proceeds = parseFloat(bondProceeds) || 0
    if (!bondDescription.trim()) return

    const item = {
      type: 'bond_sale',
      description: bondDescription,
      costBasis,
      proceeds,
      year: filingYear,
    }

    if (editingBondSale) {
      updateIncome({ ...editingBondSale, ...item })
    } else {
      addIncome(item)
    }
    setBondSaleModalOpen(false)
  }

  const handleDeleteBondSale = () => {
    if (editingBondSale) {
      deleteIncome(editingBondSale.id)
      setBondSaleModalOpen(false)
    }
  }

  // Derivative modal handlers
  const openDerivativeModal = (item = null) => {
    if (item) {
      setEditingDerivative(item)
      setDerivativeDescription(item.description || '')
      setDerivativeSubtype(item.subtype || 'option_gain')
      setDerivativeAmount((item.amount || 0).toString())
    } else {
      setEditingDerivative(null)
      setDerivativeDescription('')
      setDerivativeSubtype('option_gain')
      setDerivativeAmount('')
    }
    setDerivativeModalOpen(true)
  }

  const saveDerivative = () => {
    const amount = parseFloat(derivativeAmount) || 0
    if (!derivativeDescription.trim()) return

    const item = {
      type: 'derivative',
      subtype: derivativeSubtype,
      description: derivativeDescription,
      amount,
      year: filingYear,
    }

    if (editingDerivative) {
      updateIncome({ ...editingDerivative, ...item })
    } else {
      addIncome(item)
    }
    setDerivativeModalOpen(false)
  }

  const handleDeleteDerivative = () => {
    if (editingDerivative) {
      deleteIncome(editingDerivative.id)
      setDerivativeModalOpen(false)
    }
  }

  // Sale wizard handlers
  const openSaleModal = () => {
    setSaleStep(1)
    setSaleFundId('')
    setSalePurchaseYear('')
    setSaleVpYearData({})
    setSaleIsFirstSale(null)
    setSaleVpExpanded(false)
    setSalePreviousVpUsed('0')
    setSaleCostBasis('')
    setSaleProceeds('')
    setSaleModalOpen(true)
  }

  const closeSaleModal = () => {
    setSaleModalOpen(false)
  }

  const nextSaleStep = () => setSaleStep((s) => s + 1)
  const prevSaleStep = () => setSaleStep((s) => s - 1)

  // Get VP years relevant for this fund (from purchase year to filing year - 1)
  const getRelevantVpYears = () => {
    const purchaseYr = parseInt(salePurchaseYear) || 2024
    return vpYears.filter((y) => y >= purchaseYr && y < filingYear)
  }

  // Calculate VP for a single year from portfolio values
  const calculateYearVp = (year) => {
    const yearData = saleVpYearData[year]
    if (!yearData || yearData.notResident) return 0

    const fund = funds.find((f) => f.id === saleFundId)
    if (!fund) return 0

    // Pro-rata for purchase year (month 1 = January as conservative default)
    const purchaseYr = parseInt(salePurchaseYear) || 0
    const acquiredMonth = (year === purchaseYr) ? 1 : null

    const vp = calculateVorabpauschale(
      parseFloat(yearData.valueStart) || 0,
      parseFloat(yearData.valueEnd) || 0,
      parseFloat(yearData.distributions) || 0,
      fund.type,
      year,
      acquiredMonth
    )
    return vp?.vopiBeforeExemption || 0
  }

  // Calculate total VP accumulated from all years
  const getTotalVpAccumulated = () => {
    return getRelevantVpYears().reduce((sum, year) => {
      return sum + calculateYearVp(year)
    }, 0)
  }

  // Calculate available VP credit (total - previously used)
  const getAvailableVpCredit = () => {
    return Math.max(0, getTotalVpAccumulated() - (parseFloat(salePreviousVpUsed) || 0))
  }

  // Update year data helper
  const updateSaleVpYearData = (year, field, value) => {
    setSaleVpYearData((prev) => ({
      ...prev,
      [year]: {
        ...prev[year],
        [field]: value,
      },
    }))
  }

  const saveSale = () => {
    if (!saleFundId) return
    const fund = funds.find((f) => f.id === saleFundId)
    if (!fund) return

    const vpCredit = getAvailableVpCredit()

    addSale({
      fundId: saleFundId,
      fundType: fund.type,
      costBasis: parseFloat(saleCostBasis) || 0,
      proceeds: parseFloat(saleProceeds) || 0,
      vpCredit,
      vpYearData: saleVpYearData,
      previousVpUsed: parseFloat(salePreviousVpUsed) || 0,
      purchaseYear: parseInt(salePurchaseYear),
      year: filingYear,
    })
    setSaleModalOpen(false)
  }

  // Preview calculations - VP based on acquisition type
  const fundPreviewVP = (() => {
    if (acquisitionType === 'before') {
      return calculateVorabpauschale(
        parseFloat(valueStart) || 0,
        parseFloat(valueEnd) || 0,
        parseFloat(distributions) || 0,
        fundType,
        dataYear,
        null
      )
    } else {
      // multiple
      return calculateVorabpauschaleMultiple(
        multiplePurchases.map(p => ({
          month: parseInt(p.month),
          amount: parseFloat(p.amount) || 0
        })),
        parseFloat(distributions) || 0,
        fundType,
        dataYear
      )
    }
  })()

  // Sale calculations (for result step)
  const saleGain = (parseFloat(saleProceeds) || 0) - (parseFloat(saleCostBasis) || 0)
  const saleVpCredit = getAvailableVpCredit()
  const saleTaxableAfterVP = Math.max(0, saleGain - saleVpCredit)
  const selectedFund = funds.find((f) => f.id === saleFundId)
  const saleTfRate = selectedFund ? TEILFREISTELLUNG[selectedFund.type] : 0.3
  const saleTfAmount = saleTaxableAfterVP * saleTfRate
  const saleFinalTaxable = saleTaxableAfterVP - saleTfAmount
  const saleEstimatedTax = calculateTax(saleFinalTaxable)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="w-9 h-9" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">German Investment Tax Tracker</h1>
              <p className="text-sm text-gray-500">ELSTER filing helper for foreign brokers & banks</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Tax return:</span>
              <Select value={filingYear.toString()} onValueChange={(v) => setFilingYear(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-600 mt-1">Deadline: {getDeadline(filingYear)}</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Funds Section */}
        <Card>
          <CardHeader>
            <CardTitle>ETFs & Funds</CardTitle>
            <CardDescription>Fund gains are taxed yearly in Germany, even if you don't sell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {funds.length === 0 ? (
              <p className="text-sm text-gray-400">—</p>
            ) : (
              <div className="space-y-3">
                {fundVPs.map(({ fund, vp, snapshot }) => (
                  <div
                    key={fund.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer"
                    onClick={() => openFundModal(fund)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{fund.name}</div>
                        <div className="text-sm text-gray-500">{FUND_TYPE_LABELS[fund.type]}</div>
                      </div>
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </div>
                    {snapshot ? (
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs">
                            {snapshot.acquisitionType === 'before' || (!snapshot.acquisitionType && !snapshot.singlePurchase && !snapshot.purchases) ? 'Jan 1' : 'Invested'}
                          </div>
                          <div>
                            {snapshot.acquisitionType === 'before' || (!snapshot.acquisitionType && !snapshot.singlePurchase && !snapshot.purchases)
                              ? formatCurrency(snapshot.valueStart)
                              : snapshot.acquisitionType === 'single'
                                ? formatCurrency(snapshot.singlePurchase?.amount || 0)
                                : formatCurrency(snapshot.purchases?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0)}

                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Dec 31</div>
                          <div>{formatCurrency(snapshot.valueEnd)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Distributions</div>
                          <div>{formatCurrency(snapshot.distributions)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Vorabpauschale</div>
                          <div className="font-medium text-emerald-600">
                            {formatCurrency(vp?.vopiBeforeExemption || 0)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        {(() => {
                          const priorYears = Object.keys(fund.snapshots || {}).map(Number).filter(y => y < dataYear).sort((a, b) => b - a)
                          const priorYear = priorYears[0]
                          return priorYear && fund.snapshots[priorYear]?.valueEnd
                            ? `No ${dataYear} data — click to pre-fill from ${priorYear}`
                            : `No ${dataYear} data entered`
                        })()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center pt-4">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900" onClick={() => openFundModal()}>
                <Plus className="w-4 h-4 mr-1" /> Add ETF/Fund
              </Button>
              {funds.length > 0 && (
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total Vorabpauschale</div>
                  <div className="font-semibold">{formatCurrency(totalVP)}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Capital Gains Section */}
        <Card>
          <CardHeader>
            <CardTitle>Capital Gains</CardTitle>
            <CardDescription>Investment income from your foreign broker or bank</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show empty state if nothing recorded */}
            {interestItems.length === 0 && dividendItems.length === 0 && yearSales.length === 0 &&
             stockSaleItems.length === 0 && bondSaleItems.length === 0 && derivativeItems.length === 0 && (
              <p className="text-sm text-gray-400">No capital gains recorded yet</p>
            )}

            {/* Interest - only show if has data */}
            {interestItems.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Interest</div>
                <div className="space-y-1">
                  {interestItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => openIncomeModal(item)}
                    >
                      <span>{item.description || 'Interest'}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dividends - only show if has data */}
            {dividendItems.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Dividends</div>
                <div className="space-y-1">
                  {dividendItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => openIncomeModal(item)}
                    >
                      <span>{item.description || 'Dividends'}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ETF/Fund Sales - only show if has data */}
            {yearSales.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">ETF/Fund Sales</div>
                <div className="space-y-1">
                  {yearSales.map((sale) => {
                    const gain = sale.proceeds - sale.costBasis
                    const fund = funds.find((f) => f.id === sale.fundId)
                    return (
                      <div key={sale.id} className="flex justify-between py-2 px-3 bg-gray-50 rounded">
                        <span>{fund?.name || 'Fund sale'}</span>
                        <span className={`font-medium ${gain < 0 ? 'text-red-500' : ''}`}>
                          {formatCurrency(gain)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stock Sales - only show if has data */}
            {stockSaleItems.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Stock Sales</div>
                <div className="space-y-1">
                  {stockSaleItems.map((item) => {
                    const gain = (item.proceeds || 0) - (item.costBasis || 0)
                    return (
                      <div
                        key={item.id}
                        className="flex justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => openStockSaleModal(item)}
                      >
                        <span>{item.description || 'Stock sale'}</span>
                        <span className={`font-medium ${gain < 0 ? 'text-red-500' : ''}`}>
                          {formatCurrency(gain)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Bond Sales - only show if has data */}
            {bondSaleItems.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bond Sales</div>
                <div className="space-y-1">
                  {bondSaleItems.map((item) => {
                    const gain = (item.proceeds || 0) - (item.costBasis || 0)
                    return (
                      <div
                        key={item.id}
                        className="flex justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => openBondSaleModal(item)}
                      >
                        <span>{item.description || 'Bond sale'}</span>
                        <span className={`font-medium ${gain < 0 ? 'text-red-500' : ''}`}>
                          {formatCurrency(gain)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Derivatives/Options - only show if has data */}
            {derivativeItems.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Derivatives/Options</div>
                <div className="space-y-1">
                  {derivativeItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => openDerivativeModal(item)}
                    >
                      <span>{item.description || 'Derivative'}</span>
                      <span className={`font-medium ${(item.amount || 0) < 0 ? 'text-red-500' : ''}`}>
                        {formatCurrency(item.amount || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
                    <Plus className="w-4 h-4 mr-1" /> Add <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Income</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => openIncomeModal(null, 'interest')}>
                    Interest
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openIncomeModal(null, 'dividends')}>
                    Dividends
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Sales</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => openStockSaleModal()}>
                    Sold Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openBondSaleModal()}>
                    Sold Bond
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openSaleModal}>
                    Sold ETF/Fund
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openDerivativeModal()}>
                    Derivatives
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="text-right">
                <div className="text-xs text-gray-500">Total Capital Gains</div>
                <div className="font-semibold">{formatCurrency(totalCapitalGains)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ELSTER Output */}
        <Card>
          <CardHeader>
            <CardTitle>ELSTER Output</CardTitle>
            <CardDescription>Reference values for Anlage KAP-INV and KAP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm font-medium mb-2">Anlage KAP-INV</div>
              <div className="space-y-1">
                {/* Zeilen 4-8: Ausschüttungen (distributions) by fund type */}
                {[
                  ['zeile4', 'Zeile 4 (Ausschüttungen Aktienfonds)', distByType.aktienfonds, 'aktienfonds'],
                  ['zeile5', 'Zeile 5 (Ausschüttungen Mischfonds)', distByType.mischfonds, 'mischfonds'],
                  ['zeile6', 'Zeile 6 (Ausschüttungen Immobilienfonds)', distByType.immobilienfonds, 'immobilienfonds'],
                  ['zeile7', 'Zeile 7 (Ausschüttungen Ausl. Immobilienfonds)', distByType.auslands_immobilienfonds, 'auslands_immobilienfonds'],
                  ['zeile8', 'Zeile 8 (Ausschüttungen Sonstige)', distByType.sonstige, 'sonstige'],
                ].map(([key, label, value, fundTypeKey]) => {
                  const fundsOfType = fundVPs.filter(({ fund, snapshot }) => fund.type === fundTypeKey && (snapshot?.distributions || 0) > 0)
                  const hasBreakdown = fundsOfType.length > 0
                  return (
                    <div key={key}>
                      <div
                        className={`flex justify-between py-2 px-3 bg-gray-50 rounded text-sm ${hasBreakdown ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                        onClick={() => hasBreakdown && toggleElster(key)}
                      >
                        <span className="text-gray-600 flex items-center gap-1">
                          {hasBreakdown && (
                            <ChevronRight className={`w-3 h-3 transition-transform ${expandedElster[key] ? 'rotate-90' : ''}`} />
                          )}
                          {label}
                        </span>
                        <span className="font-mono font-medium">{formatCurrency(value)}</span>
                      </div>
                      {expandedElster[key] && hasBreakdown && (
                        <div className="pl-6 space-y-1 mt-1 mb-2">
                          {fundsOfType.map(({ fund, snapshot }) => (
                            <div key={fund.id} className="flex justify-between py-1 px-3 text-xs text-gray-500">
                              <span>{fund.name}</span>
                              <span className="font-mono">{formatCurrency(snapshot?.distributions || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Zeilen 9-13: Vorabpauschale by fund type */}
                {[
                  ['zeile9', 'Zeile 9 (Vorabpauschale Aktienfonds)', vpByType.aktienfonds, 'aktienfonds'],
                  ['zeile10', 'Zeile 10 (Vorabpauschale Mischfonds)', vpByType.mischfonds, 'mischfonds'],
                  ['zeile11', 'Zeile 11 (Vorabpauschale Immobilienfonds)', vpByType.immobilienfonds, 'immobilienfonds'],
                  ['zeile12', 'Zeile 12 (Vorabpauschale Ausl. Immobilienfonds)', vpByType.auslands_immobilienfonds, 'auslands_immobilienfonds'],
                  ['zeile13', 'Zeile 13 (Vorabpauschale Sonstige)', vpByType.sonstige, 'sonstige'],
                ].map(([key, label, value, fundTypeKey]) => {
                  const fundsOfType = fundVPs.filter(({ fund, vp }) => fund.type === fundTypeKey && vp?.vopiBeforeExemption > 0)
                  const hasBreakdown = fundsOfType.length > 0
                  return (
                    <div key={key}>
                      <div
                        className={`flex justify-between py-2 px-3 bg-gray-50 rounded text-sm ${hasBreakdown ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                        onClick={() => hasBreakdown && toggleElster(key)}
                      >
                        <span className="text-gray-600 flex items-center gap-1">
                          {hasBreakdown && (
                            <ChevronRight className={`w-3 h-3 transition-transform ${expandedElster[key] ? 'rotate-90' : ''}`} />
                          )}
                          {label}
                        </span>
                        <span className="font-mono font-medium">{formatCurrency(value)}</span>
                      </div>
                      {expandedElster[key] && hasBreakdown && (
                        <div className="pl-6 space-y-1 mt-1 mb-2">
                          {fundsOfType.map(({ fund, vp }) => (
                            <div key={fund.id} className="flex justify-between py-1 px-3 text-xs text-gray-500">
                              <span>{fund.name}</span>
                              <span className="font-mono">{formatCurrency(vp.vopiBeforeExemption)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Zeilen 14-28: Veräußerungsgewinne/-verluste by fund type (vor Teilfreistellung) */}
                {/* Per § 19 Abs. 1 InvStG: Gain = Proceeds - CostBasis - VP (vor TFS) */}
                {[
                  ['zeile14', 'Zeile 14 (Veräußerung Aktienfonds)', saleGainByType.aktienfonds, 'aktienfonds'],
                  ['zeile17', 'Zeile 17 (Veräußerung Mischfonds)', saleGainByType.mischfonds, 'mischfonds'],
                  ['zeile20kiv', 'Zeile 20 (Veräußerung Immobilienfonds)', saleGainByType.immobilienfonds, 'immobilienfonds'],
                  ['zeile23', 'Zeile 23 (Veräußerung Ausl. Immobilienfonds)', saleGainByType.auslands_immobilienfonds, 'auslands_immobilienfonds'],
                  ['zeile26', 'Zeile 26 (Veräußerung Sonstige)', saleGainByType.sonstige, 'sonstige'],
                ].map(([key, label, value, fundTypeKey]) => {
                  const salesOfType = yearSales.filter((s) => s.fundType === fundTypeKey)
                  const hasBreakdown = salesOfType.length > 0
                  return (
                    <div key={key}>
                      <div
                        className={`flex justify-between py-2 px-3 bg-gray-50 rounded text-sm ${hasBreakdown ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                        onClick={() => hasBreakdown && toggleElster(key)}
                      >
                        <span className="text-gray-600 flex items-center gap-1">
                          {hasBreakdown && (
                            <ChevronRight className={`w-3 h-3 transition-transform ${expandedElster[key] ? 'rotate-90' : ''}`} />
                          )}
                          {label}
                        </span>
                        <span className="font-mono font-medium">{formatCurrency(value)}</span>
                      </div>
                      {expandedElster[key] && hasBreakdown && (
                        <div className="pl-6 space-y-1 mt-1 mb-2">
                          {salesOfType.map((sale) => {
                            const fund = funds.find((f) => f.id === sale.fundId)
                            const gain = (sale.proceeds || 0) - (sale.costBasis || 0) - (sale.vpCredit || 0)
                            return (
                              <div key={sale.id} className="flex justify-between py-1 px-3 text-xs text-gray-500">
                                <span>{fund?.name || 'Fund sale'}</span>
                                <span className="font-mono">{formatCurrency(gain)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Anlage KAP</div>
              <div className="space-y-1">
                {/* Zeile 19 - Kapitalerträge */}
                <div>
                  <div
                    className={`flex justify-between py-2 px-3 bg-gray-50 rounded text-sm ${totalZeile19 !== 0 ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                    onClick={() => totalZeile19 !== 0 && toggleElster('zeile19')}
                  >
                    <span className="text-gray-600 flex items-center gap-1">
                      {totalZeile19 !== 0 && (
                        <ChevronRight className={`w-3 h-3 transition-transform ${expandedElster.zeile19 ? 'rotate-90' : ''}`} />
                      )}
                      Zeile 19 (Kapitalerträge)
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(totalZeile19)}</span>
                  </div>
                  {expandedElster.zeile19 && totalZeile19 !== 0 && (
                    <div className="pl-6 space-y-1 mt-1 mb-2">
                      {totalInterest !== 0 && (
                        <div className="flex justify-between py-1 px-3 text-xs text-gray-500">
                          <span>Interest</span>
                          <span className="font-mono">{formatCurrency(totalInterest)}</span>
                        </div>
                      )}
                      {totalDividends !== 0 && (
                        <div className="flex justify-between py-1 px-3 text-xs text-gray-500">
                          <span>Dividends</span>
                          <span className="font-mono">{formatCurrency(totalDividends)}</span>
                        </div>
                      )}
                      {totalStockGains !== 0 && (
                        <div className="flex justify-between py-1 px-3 text-xs text-gray-500">
                          <span>Stock sales</span>
                          <span className="font-mono">{formatCurrency(totalStockGains)}</span>
                        </div>
                      )}
                      {totalBondGains !== 0 && (
                        <div className="flex justify-between py-1 px-3 text-xs text-gray-500">
                          <span>Bond sales</span>
                          <span className="font-mono">{formatCurrency(totalBondGains)}</span>
                        </div>
                      )}
                      {totalDerivatives !== 0 && (
                        <div className="flex justify-between py-1 px-3 text-xs text-gray-500">
                          <span>Derivatives</span>
                          <span className="font-mono">{formatCurrency(totalDerivatives)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Zeile 20 - Aktienveräußerungen */}
                <div>
                  <div
                    className={`flex justify-between py-2 px-3 bg-gray-50 rounded text-sm ${stockSaleItems.length > 0 ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                    onClick={() => stockSaleItems.length > 0 && toggleElster('zeile20')}
                  >
                    <span className="text-gray-600 flex items-center gap-1">
                      {stockSaleItems.length > 0 && (
                        <ChevronRight className={`w-3 h-3 transition-transform ${expandedElster.zeile20 ? 'rotate-90' : ''}`} />
                      )}
                      Zeile 20 (davon Aktienveräußerungen)
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(totalZeile20)}</span>
                  </div>
                  {expandedElster.zeile20 && stockSaleItems.length > 0 && (
                    <div className="pl-6 space-y-1 mt-1 mb-2">
                      {stockSaleItems.map((item) => {
                        const gain = (item.proceeds || 0) - (item.costBasis || 0)
                        return (
                          <div key={item.id} className="flex justify-between py-1 px-3 text-xs text-gray-500">
                            <span>{item.description || 'Stock sale'}</span>
                            <span className="font-mono">{formatCurrency(gain)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Zeile 41 - Quellensteuer */}
                <div>
                  {(() => {
                    const itemsWithWithholding = yearIncomes.filter(i => (i.withholdingTax || 0) > 0)
                    const hasBreakdown = itemsWithWithholding.length > 0
                    return (
                      <>
                        <div
                          className={`flex justify-between py-2 px-3 bg-gray-50 rounded text-sm ${hasBreakdown ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                          onClick={() => hasBreakdown && toggleElster('zeile41')}
                        >
                          <span className="text-gray-600 flex items-center gap-1">
                            {hasBreakdown && (
                              <ChevronRight className={`w-3 h-3 transition-transform ${expandedElster.zeile41 ? 'rotate-90' : ''}`} />
                            )}
                            Zeile 41 (Quellensteuer)
                          </span>
                          <span className="font-mono font-medium">{formatCurrency(totalWithholding)}</span>
                        </div>
                        {expandedElster.zeile41 && hasBreakdown && (
                          <div className="pl-6 space-y-1 mt-1 mb-2">
                            {itemsWithWithholding.map((item) => (
                              <div key={item.id} className="flex justify-between py-1 px-3 text-xs text-gray-500">
                                <span>{item.description || (item.type === 'interest' ? 'Interest' : 'Dividends')}</span>
                                <span className="font-mono">{formatCurrency(item.withholdingTax)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-gray-600 mb-1">This is a free side project — always double-check the numbers before filing.</p>
          <p className="text-sm text-gray-600 mb-4">All data stays in your browser. Nothing is sent to any server.</p>
          <p className="mb-4">
            <a href="/how-it-works" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
              How the calculations work
            </a>
          </p>
          <div className="text-xs text-gray-500 mb-4 space-y-2">
            <p>
              <strong>Disclaimer / Haftungsausschluss:</strong> This free tool is a calculation aid (Rechenhilfe) for informational purposes only. It does not constitute tax advisory services (Steuerberatung) within the meaning of the Steuerberatungsgesetz. No advisory or professional relationship is created.
            </p>
            <p>
              No guarantee is made regarding the accuracy, completeness, or timeliness of the calculations. Users are solely responsible for verifying all values before filing their tax return. Always consult a qualified tax advisor (Steuerberater) for individual advice. The operator assumes no liability except as required by mandatory law.
            </p>
            <p className="text-gray-400">
              Dieses kostenlose Tool ist eine Rechenhilfe zu Informationszwecken. Es stellt keine Steuerberatung im Sinne des Steuerberatungsgesetzes dar. Für die Richtigkeit der Berechnungen wird keine Gewähr übernommen. Der Nutzer ist allein verantwortlich für die Überprüfung aller Werte. Die Haftung des Betreibers ist auf Vorsatz und grobe Fahrlässigkeit beschränkt.
            </p>
          </div>
          <p className="text-xs text-gray-400 space-x-3">
            <span>© 2026 German Investment Tax Tracker</span>
          </p>
        </div>
      </footer>

      {/* Fund Modal */}
      <Dialog open={fundModalOpen} onOpenChange={setFundModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFund ? 'Edit Fund' : 'Add Fund'}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-gray-500">
                {dataYear} values needed — Vorabpauschale is taxed in the following year
                {editingFund && !editingFund.snapshots?.[dataYear] && (() => {
                  const priorYears = Object.keys(editingFund.snapshots || {}).map(Number).filter(y => y < dataYear).sort((a, b) => b - a)
                  const priorYear = priorYears[0]
                  return priorYear && editingFund.snapshots[priorYear]?.valueEnd
                    ? `. Jan 1 value pre-filled from Dec 31, ${priorYear}.`
                    : ''
                })()}
                <details className="mt-1">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 outline-none">Why {dataYear} and not {filingYear}?</summary>
                  <p className="mt-1 text-xs text-gray-500">
                    Stock sales are taxed in the year you sell — straightforward. But the Vorabpauschale works differently: it's calculated on your {dataYear} fund values, then deemed received on January 2, {filingYear}. So it becomes taxable income for {filingYear}, which you file in {filingYear + 1}. That's why you enter {dataYear} data here even though you're filing for {filingYear}.
                  </p>
                </details>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                placeholder="e.g., VWCE, My ETF"
              />
            </div>
            <div className="space-y-2">
              <Label>Fund Type</Label>
              <Select value={fundType} onValueChange={setFundType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUND_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>How did you acquire this fund in {dataYear}?</Label>
              <Select value={acquisitionType} onValueChange={(v) => {
                setAcquisitionType(v)
                if (v === 'multiple' && multiplePurchases.length === 0) {
                  setMultiplePurchases([{ month: '1', amount: '' }])
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Owned before {dataYear}</SelectItem>
                  <SelectItem value="multiple">First bought in {dataYear}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic content based on acquisition type */}
            {acquisitionType === 'before' && (
              <div className="pt-2">
                <div className="text-sm font-medium mb-1">Portfolio value in {dataYear}</div>
                <div className="text-xs text-gray-500 mb-3">Total value of your holdings in this fund</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Jan 1</Label>
                    <Input
                      type="number"
                      value={valueStart}
                      onChange={(e) => setValueStart(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Dec 31</Label>
                    <Input
                      type="number"
                      value={valueEnd}
                      onChange={(e) => setValueEnd(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Dividends received</Label>
                    <Input
                      type="number"
                      value={distributions}
                      onChange={(e) => setDistributions(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {acquisitionType === 'multiple' && (
              <div className="pt-2 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Purchases in {dataYear}</Label>
                  {multiplePurchases.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">No purchases added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {multiplePurchases.map((purchase, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Select value={purchase.month} onValueChange={(v) => updatePurchase(index, 'month', v)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>{month}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={purchase.amount}
                            onChange={(e) => updatePurchase(index, 'amount', e.target.value)}
                            placeholder="Amount"
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-red-500 px-2"
                            onClick={() => removePurchase(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="text-gray-500" onClick={addPurchase}>
                    <Plus className="w-4 h-4 mr-1" /> Add purchase
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Dec 31 value</Label>
                    <Input
                      type="number"
                      value={valueEnd}
                      onChange={(e) => setValueEnd(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Dividends received</Label>
                    <Input
                      type="number"
                      value={distributions}
                      onChange={(e) => setDistributions(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  Note: VP is approximated using invested amounts. Exact calculation would require Jan 1 fund NAV multiplied by shares for each purchase.
                </p>
              </div>
            )}

            {/* VP Preview */}
            <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Vorabpauschale:</span>
                <span className="font-medium">{formatCurrency(fundPreviewVP.vopiBeforeExemption)}</span>
              </div>
              {acquisitionType === 'multiple' && multiplePurchases.length > 0 && fundPreviewVP.purchaseDetails && (
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  {fundPreviewVP.purchaseDetails.map((detail, i) => (
                    <div key={i}>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][detail.month - 1]}: {formatCurrency(detail.amount)} ({detail.proRataMonths}/12)
                    </div>
                  ))}
                </div>
              )}
              {fundPreviewVP.isApproximation && acquisitionType === 'multiple' && (
                <p className="text-xs text-amber-500 mt-1">Approximation</p>
              )}
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {editingFund && (
              <Button variant="ghost" className="text-red-500 hover:text-red-600 mr-auto" onClick={handleDeleteFund}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFundModalOpen(false)}>Cancel</Button>
              <Button onClick={saveFund}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income Modal */}
      <Dialog open={incomeModalOpen} onOpenChange={setIncomeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIncome ? 'Edit Income' : 'Add Income'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={incomeType} onValueChange={setIncomeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="dividends">Dividends</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount received</Label>
              <Input
                type="number"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={incomeDescription}
                onChange={(e) => setIncomeDescription(e.target.value)}
                placeholder="e.g., Q1 dividends"
              />
            </div>
            <div className="space-y-2">
              <Label>Foreign tax already deducted (optional)</Label>
              <Input
                type="number"
                value={incomeWithholding}
                onChange={(e) => setIncomeWithholding(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-gray-500">E.g., US withholds 15% on dividends. Leave 0 if unsure.</p>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {editingIncome && (
              <Button variant="ghost" className="text-red-500 hover:text-red-600 mr-auto" onClick={handleDeleteIncome}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIncomeModalOpen(false)}>Cancel</Button>
              <Button onClick={saveIncome}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Wizard Modal */}
      <Dialog open={saleModalOpen} onOpenChange={closeSaleModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record ETF/Fund Sale</DialogTitle>
            <DialogDescription>Step {saleStep} of 5</DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Fund */}
          {saleStep === 1 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Which ETF/fund did you (fully or partly) sell?</Label>
                <Select value={saleFundId} onValueChange={setSaleFundId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fund..." />
                  </SelectTrigger>
                  <SelectContent>
                    {funds.map((fund) => (
                      <SelectItem key={fund.id} value={fund.id}>{fund.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeSaleModal}>Cancel</Button>
                <Button onClick={nextSaleStep} disabled={!saleFundId}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Purchase Year */}
          {saleStep === 2 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>When did you first buy this fund?</Label>
                <p className="text-xs text-gray-500">This determines how many years of Vorabpauschale you may have accumulated</p>
                <Select value={salePurchaseYear} onValueChange={setSalePurchaseYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: filingYear - 2018 }, (_, i) => 2018 + i).filter((y) => {
                      const fund = funds.find(f => f.id === saleFundId)
                      const earliestSnapshot = fund?.snapshots ? Math.min(...Object.keys(fund.snapshots).map(Number)) : Infinity
                      return y <= earliestSnapshot
                    }).map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="flex justify-between">
                <Button variant="outline" onClick={prevSaleStep}>Back</Button>
                <Button onClick={nextSaleStep} disabled={!salePurchaseYear}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: VP History */}
          {saleStep === 3 && (() => {
            const relevantYears = getRelevantVpYears()
            const allPrefilled = relevantYears.length > 0 && relevantYears.every(
              year => selectedSaleFund?.snapshots?.[year]
            )

            return (
              <div className="space-y-4 py-4">
                <div>
                  <Label>How much Vorabpauschale can you deduct?</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    VP you've already paid on this fund can reduce your taxable gain.
                  </p>
                </div>
                {relevantYears.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">
                    No Vorabpauschale applies for your holding period. In 2021 and 2022, the base rate was negative, so no VP was charged.
                  </p>
                ) : allPrefilled && !saleVpExpanded ? (
                  // Simplified view when all data is pre-filled
                  <div className="space-y-3">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 mb-2">
                        <span className="text-sm font-medium">✓ VP data loaded from your fund</span>
                      </div>
                      <div className="text-2xl font-semibold text-green-800">
                        {formatCurrency(getTotalVpAccumulated())}
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        Total VP accumulated ({relevantYears.join(', ')})
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500"
                      onClick={() => setSaleVpExpanded(true)}
                    >
                      Edit details
                    </Button>
                  </div>
                ) : (
                  // Full form view
                  <div className="space-y-4">
                    {relevantYears.map((year) => {
                      const yearData = saleVpYearData[year] || {}
                      const yearVp = calculateYearVp(year)
                      const isDisabled = yearData.notResident
                      const hasPrefilled = selectedSaleFund?.snapshots?.[year]

                      return (
                        <div key={year} className="p-3 bg-gray-50 rounded-lg space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{year}</span>
                              {hasPrefilled && (
                                <span className="text-xs text-green-600">✓ Pre-filled</span>
                              )}
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={yearData.notResident || false}
                                onChange={(e) => updateSaleVpYearData(year, 'notResident', e.target.checked)}
                                className="rounded"
                              />
                              Not a German tax resident this year
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">Jan 1</Label>
                              <Input
                                type="number"
                                value={yearData.valueStart || ''}
                                onChange={(e) => updateSaleVpYearData(year, 'valueStart', e.target.value)}
                                placeholder="0.00"
                                disabled={isDisabled}
                                className={isDisabled ? 'bg-gray-100' : ''}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">Dec 31</Label>
                              <Input
                                type="number"
                                value={yearData.valueEnd || ''}
                                onChange={(e) => updateSaleVpYearData(year, 'valueEnd', e.target.value)}
                                placeholder="0.00"
                                disabled={isDisabled}
                                className={isDisabled ? 'bg-gray-100' : ''}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">Dividends</Label>
                              <Input
                                type="number"
                                value={yearData.distributions || ''}
                                onChange={(e) => updateSaleVpYearData(year, 'distributions', e.target.value)}
                                placeholder="0"
                                disabled={isDisabled}
                                className={isDisabled ? 'bg-gray-100' : ''}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end text-sm">
                            <span className="text-gray-500 mr-2">VP:</span>
                            <span className="font-medium">{formatCurrency(yearVp)}</span>
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-2 flex justify-between text-sm font-medium">
                      <span>Total VP accumulated:</span>
                      <span>{formatCurrency(getTotalVpAccumulated())}</span>
                    </div>
                    {allPrefilled && saleVpExpanded && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500"
                        onClick={() => setSaleVpExpanded(false)}
                      >
                        Hide details
                      </Button>
                    )}
                  </div>
                )}
                <DialogFooter className="flex justify-between">
                  <Button variant="outline" onClick={prevSaleStep}>Back</Button>
                  <Button onClick={nextSaleStep}>Next</Button>
                </DialogFooter>
              </div>
            )
          })()}

          {/* Step 4: Previous Sales */}
          {saleStep === 4 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Is this your first time selling this fund?</Label>
              </div>

              {saleIsFirstSale === null && (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSaleIsFirstSale(true)
                      setSalePreviousVpUsed('0')
                    }}
                  >
                    Yes, first sale
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSaleIsFirstSale(false)}
                  >
                    No, sold before
                  </Button>
                </div>
              )}

              {saleIsFirstSale === true && (
                <div className="p-3 bg-green-50 rounded text-sm text-green-700">
                  All accumulated VP credit is available for this sale.
                </div>
              )}

              {saleIsFirstSale === false && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    If you deducted VP in a previous sale of this fund, that credit is no longer available.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">VP deducted in previous sales (€)</Label>
                    <Input
                      type="number"
                      value={salePreviousVpUsed}
                      onChange={(e) => setSalePreviousVpUsed(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-400">
                      Example: Sold €5,000 of VWCE in 2023, deducted €45 VP → enter 45
                    </p>
                  </div>
                </div>
              )}

              {saleIsFirstSale !== null && (
                <>
                  <div className="pt-2 p-3 bg-gray-50 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total VP accumulated:</span>
                      <span>{formatCurrency(getTotalVpAccumulated())}</span>
                    </div>
                    {saleIsFirstSale === false && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Previously used:</span>
                        <span>-{formatCurrency(parseFloat(salePreviousVpUsed) || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium pt-1 border-t mt-1">
                      <span>Available VP credit:</span>
                      <span>{formatCurrency(getAvailableVpCredit())}</span>
                    </div>
                  </div>
                  <DialogFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => {
                      setSaleIsFirstSale(null)
                      prevSaleStep()
                    }}>Back</Button>
                    <Button onClick={nextSaleStep}>Next</Button>
                  </DialogFooter>
                </>
              )}

              {saleIsFirstSale === null && (
                <DialogFooter className="flex justify-between">
                  <Button variant="outline" onClick={prevSaleStep}>Back</Button>
                </DialogFooter>
              )}
            </div>
          )}

          {/* Step 5: Sale Details + Result */}
          {saleStep === 5 && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>What you paid</Label>
                  <Input
                    type="number"
                    value={saleCostBasis}
                    onChange={(e) => setSaleCostBasis(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-400">Total purchase price</p>
                </div>
                <div className="space-y-2">
                  <Label>What you sold for</Label>
                  <Input
                    type="number"
                    value={saleProceeds}
                    onChange={(e) => setSaleProceeds(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-400">Total sale proceeds</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Capital gain:</span>
                  <span>{formatCurrency(saleGain)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">VP credit:</span>
                  <span>-{formatCurrency(saleVpCredit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Taxable gain:</span>
                  <span>{formatCurrency(saleTaxableAfterVP)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-500">Teilfreistellung ({(saleTfRate * 100).toFixed(0)}%):</span>
                  <span>-{formatCurrency(saleTfAmount)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Estimated tax:</span>
                  <span>{formatCurrency(saleEstimatedTax)}</span>
                </div>
              </div>

              <DialogFooter className="flex justify-between">
                <Button variant="outline" onClick={prevSaleStep}>Back</Button>
                <Button onClick={saveSale}>Save Sale</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Sale Modal */}
      <Dialog open={stockSaleModalOpen} onOpenChange={setStockSaleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStockSale ? 'Edit Stock Sale' : 'Record Stock Sale'}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-gray-500">
                Enter the cost basis and proceeds for the shares you sold.
                <details className="mt-1">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 outline-none">Partial sales?</summary>
                  <p className="mt-1 text-xs text-gray-500">
                    Only enter the portion you sold. Example: you own 100 shares, bought at €50 each. You sell 20 at €65 each. Enter: paid = €1,000, sold for = €1,300, gain = €300.
                  </p>
                </details>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Stock name/ticker</Label>
              <Input
                value={stockDescription}
                onChange={(e) => setStockDescription(e.target.value)}
                placeholder="e.g., Apple Inc (AAPL)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>What you paid</Label>
                <Input
                  type="number"
                  value={stockCostBasis}
                  onChange={(e) => setStockCostBasis(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400">Total purchase price</p>
              </div>
              <div className="space-y-2">
                <Label>What you sold for</Label>
                <Input
                  type="number"
                  value={stockProceeds}
                  onChange={(e) => setStockProceeds(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400">Total sale proceeds</p>
              </div>
            </div>
            {stockCostBasis && stockProceeds && (
              <div className="p-3 bg-gray-50 rounded text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Gain/Loss:</span>
                  <span className={`font-medium ${(parseFloat(stockProceeds) || 0) - (parseFloat(stockCostBasis) || 0) < 0 ? 'text-red-500' : ''}`}>
                    {formatCurrency((parseFloat(stockProceeds) || 0) - (parseFloat(stockCostBasis) || 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between">
            {editingStockSale && (
              <Button variant="ghost" className="text-red-500 hover:text-red-600 mr-auto" onClick={handleDeleteStockSale}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStockSaleModalOpen(false)}>Cancel</Button>
              <Button onClick={saveStockSale}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bond Sale Modal */}
      <Dialog open={bondSaleModalOpen} onOpenChange={setBondSaleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBondSale ? 'Edit Bond Sale' : 'Record Bond Sale'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bond name/description</Label>
              <Input
                value={bondDescription}
                onChange={(e) => setBondDescription(e.target.value)}
                placeholder="e.g., German Govt Bond 2025"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>What you paid</Label>
                <Input
                  type="number"
                  value={bondCostBasis}
                  onChange={(e) => setBondCostBasis(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400">Total purchase price</p>
              </div>
              <div className="space-y-2">
                <Label>What you sold for</Label>
                <Input
                  type="number"
                  value={bondProceeds}
                  onChange={(e) => setBondProceeds(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400">Total sale proceeds</p>
              </div>
            </div>
            {bondCostBasis && bondProceeds && (
              <div className="p-3 bg-gray-50 rounded text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Gain/Loss:</span>
                  <span className={`font-medium ${(parseFloat(bondProceeds) || 0) - (parseFloat(bondCostBasis) || 0) < 0 ? 'text-red-500' : ''}`}>
                    {formatCurrency((parseFloat(bondProceeds) || 0) - (parseFloat(bondCostBasis) || 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between">
            {editingBondSale && (
              <Button variant="ghost" className="text-red-500 hover:text-red-600 mr-auto" onClick={handleDeleteBondSale}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBondSaleModalOpen(false)}>Cancel</Button>
              <Button onClick={saveBondSale}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Derivative Modal */}
      <Dialog open={derivativeModalOpen} onOpenChange={setDerivativeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDerivative ? 'Edit Derivative' : 'Record Derivative/Option'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={derivativeDescription}
                onChange={(e) => setDerivativeDescription(e.target.value)}
                placeholder="e.g., AAPL Call Option"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={derivativeSubtype} onValueChange={setDerivativeSubtype}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option_premium">Option premium received</SelectItem>
                  <SelectItem value="option_gain">Option gain</SelectItem>
                  <SelectItem value="futures">Futures gain</SelectItem>
                  <SelectItem value="other">Other derivative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (gain or premium)</Label>
              <Input
                type="number"
                value={derivativeAmount}
                onChange={(e) => setDerivativeAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-gray-400">Enter negative for losses</p>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {editingDerivative && (
              <Button variant="ghost" className="text-red-500 hover:text-red-600 mr-auto" onClick={handleDeleteDerivative}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDerivativeModalOpen(false)}>Cancel</Button>
              <Button onClick={saveDerivative}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
