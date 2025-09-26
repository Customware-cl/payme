export const formatCurrency = (amount, currency = 'CLP') => {
  const formatter = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0
  })

  return formatter.format(amount)
}

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export const formatCardNumber = (cardNumber) => {
  const cleaned = cardNumber.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  const matches = cleaned.match(/\d{4,16}/g)
  const match = matches && matches[0] || ''
  const parts = []

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4))
  }

  if (parts.length) {
    return parts.join(' ')
  } else {
    return cleaned
  }
}

export const maskCardNumber = (cardNumber) => {
  const cleaned = cardNumber.replace(/\s+/g, '')
  if (cleaned.length < 4) return cardNumber

  const lastFour = cleaned.slice(-4)
  const masked = '*'.repeat(cleaned.length - 4) + lastFour

  return formatCardNumber(masked)
}

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export const validateCardNumber = (cardNumber) => {
  const cleaned = cardNumber.replace(/\s+/g, '')
  return /^\d{13,19}$/.test(cleaned)
}

export const getCardType = (cardNumber) => {
  const cleaned = cardNumber.replace(/\s+/g, '')

  const patterns = {
    visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
    mastercard: /^5[1-5][0-9]{14}$/,
    amex: /^3[47][0-9]{13}$/,
    discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/
  }

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(cleaned)) {
      return type
    }
  }

  return 'unknown'
}