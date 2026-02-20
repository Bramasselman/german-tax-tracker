// Basiszins rates by year (from Bundesfinanzministerium)
export const BASISZINS = {
  2018: 0.0087,   // 0.87%
  2019: 0.0052,   // 0.52%
  2020: 0.0007,   // 0.07% (positive — small VP applies)
  2021: -0.0045,  // -0.45%
  2022: -0.0005,  // -0.05%
  2023: 0.0255,   // 2.55%
  2024: 0.0229,   // 2.29%
  2025: 0.0253,   // 2.53%
  2026: 0.0320,   // 3.20%
}

// Teilfreistellung rates by fund type
export const TEILFREISTELLUNG = {
  aktienfonds: 0.30,
  mischfonds: 0.15,
  immobilienfonds: 0.60,
  auslands_immobilienfonds: 0.80,
  sonstige: 0.00,
}

// Fund type labels
export const FUND_TYPE_LABELS = {
  aktienfonds: 'Equity Fund',
  mischfonds: 'Mixed Fund',
  immobilienfonds: 'Real Estate Fund',
  auslands_immobilienfonds: 'Foreign Real Estate',
  sonstige: 'Other',
}

// Calculate Vorabpauschale for a fund
// acquiredMonth: null/undefined = owned before year, 1-12 = month acquired during year
export function calculateVorabpauschale(valueStart, valueEnd, distributions, fundType, year, acquiredMonth = null) {
  const basiszins = BASISZINS[year] || 0

  // No VP if basiszins is negative or zero
  if (basiszins <= 0) {
    return { basisertrag: 0, vopiBeforeExemption: 0, vopiAfterExemption: 0, proRataMonths: 12 }
  }

  // Basisertrag = Jan 1 value × basiszins × 0.7
  const basisertrag = valueStart * basiszins * 0.7

  // Mehrbetrag per § 18 Abs. 1 Satz 3 InvStG:
  // (end price - start price) + distributions = total return including distributions
  const mehrbetrag = (valueEnd - valueStart) + distributions

  // VP before exemption = min(basisertrag, mehrbetrag) - distributions
  let vopiBeforeExemption = Math.max(0, Math.min(basisertrag, mehrbetrag) - distributions)

  // Pro-rata reduction for mid-year purchases (§ 18 Abs. 2 InvStG)
  // Reduce by 1/12 for each full month before purchase month
  let proRataMonths = 12
  if (acquiredMonth && acquiredMonth >= 1 && acquiredMonth <= 12) {
    proRataMonths = 13 - acquiredMonth  // Jan=12, Feb=11, ..., Dec=1
    vopiBeforeExemption = vopiBeforeExemption * (proRataMonths / 12)
  }

  // Apply Teilfreistellung
  const tfRate = TEILFREISTELLUNG[fundType] || 0
  const vopiAfterExemption = vopiBeforeExemption * (1 - tfRate)

  return {
    basiszins,
    basisertrag,
    mehrbetrag,
    vopiBeforeExemption,
    vopiAfterExemption,
    teilfreistellung: tfRate,
    proRataMonths,
  }
}

// Calculate Vorabpauschale for multiple purchases (approximation using invested amounts)
// purchases: array of { month: number (1-12), amount: number (invested) }
// month = 0 means owned before the year (full 12/12)
export function calculateVorabpauschaleMultiple(purchases, distributions, fundType, year) {
  const basiszins = BASISZINS[year] || 0

  // No VP if basiszins is negative or zero
  if (basiszins <= 0) {
    return {
      basiszins,
      vopiBeforeExemption: 0,
      vopiAfterExemption: 0,
      teilfreistellung: TEILFREISTELLUNG[fundType] || 0,
      purchaseDetails: [],
      isApproximation: true,
    }
  }

  let totalBasisertrag = 0
  const purchaseDetails = []

  for (const purchase of purchases) {
    const { month, amount } = purchase
    // month = 0 means owned before year (full 12 months)
    const proRataMonths = month === 0 ? 12 : 13 - month

    // Basisertrag for this purchase = invested amount × basiszins × 0.7
    const basisertrag = amount * basiszins * 0.7
    // Pro-rata VP for this purchase
    const vp = basisertrag * (proRataMonths / 12)

    totalBasisertrag += vp
    purchaseDetails.push({ month, amount, proRataMonths, basisertrag, vp })
  }

  // Subtract distributions from total (distributions reduce VP)
  const vopiBeforeExemption = Math.max(0, totalBasisertrag - distributions)

  // Apply Teilfreistellung
  const tfRate = TEILFREISTELLUNG[fundType] || 0
  const vopiAfterExemption = vopiBeforeExemption * (1 - tfRate)

  return {
    basiszins,
    vopiBeforeExemption,
    vopiAfterExemption,
    teilfreistellung: tfRate,
    purchaseDetails,
    isApproximation: true,
  }
}

// Calculate tax on capital gains (26.375% Abgeltungsteuer + Soli)
export function calculateTax(amount) {
  return Math.max(0, amount * 0.26375)
}

// Get filing deadline for a tax year
export function getDeadline(year) {
  return `31 July ${year + 1}`
}

// Format currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}
