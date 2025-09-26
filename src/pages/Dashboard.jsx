import React from 'react'
import styled from 'styled-components'
import { BarChart3, TrendingUp, DollarSign, Users, Activity } from 'lucide-react'

const DashboardContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`

const Title = styled.h1`
  color: white;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`

const StatCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-5px);
  }
`

const StatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`

const StatIcon = styled.div`
  padding: 0.75rem;
  border-radius: 10px;
  background: ${props => props.bg || '#667eea'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: #2d3748;
`

const StatLabel = styled.div`
  color: #4a5568;
  font-size: 0.9rem;
`

const StatChange = styled.div`
  font-size: 0.8rem;
  color: ${props => props.positive ? '#38a169' : '#e53e3e'};
  margin-top: 0.5rem;
`

const ChartsSection = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const ChartCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
`

const ChartTitle = styled.h3`
  color: #2d3748;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const ChartPlaceholder = styled.div`
  height: 200px;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a5568;
  font-style: italic;
`

const RecentTransactions = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-top: 1.5rem;
`

const TransactionItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e2e8f0;

  &:last-child {
    border-bottom: none;
  }
`

const TransactionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const TransactionName = styled.div`
  font-weight: 600;
  color: #2d3748;
`

const TransactionDate = styled.div`
  font-size: 0.8rem;
  color: #4a5568;
`

const TransactionAmount = styled.div`
  font-weight: bold;
  color: ${props => props.positive ? '#38a169' : '#e53e3e'};
`

function Dashboard() {
  const stats = [
    {
      label: 'Ingresos Total',
      value: '$124,532',
      change: '+12.5%',
      positive: true,
      icon: <DollarSign size={24} />,
      bg: '#38a169'
    },
    {
      label: 'Transacciones',
      value: '1,847',
      change: '+8.2%',
      positive: true,
      icon: <Activity size={24} />,
      bg: '#667eea'
    },
    {
      label: 'Usuarios Activos',
      value: '892',
      change: '+15.3%',
      positive: true,
      icon: <Users size={24} />,
      bg: '#ed8936'
    },
    {
      label: 'Tasa Conversión',
      value: '4.2%',
      change: '-2.1%',
      positive: false,
      icon: <TrendingUp size={24} />,
      bg: '#9f7aea'
    }
  ]

  const recentTransactions = [
    { name: 'Pago de Juan Pérez', date: 'Hace 2 horas', amount: '+$1,200', positive: true },
    { name: 'Reembolso Cliente', date: 'Hace 4 horas', amount: '-$350', positive: false },
    { name: 'Pago de María García', date: 'Hace 6 horas', amount: '+$850', positive: true },
    { name: 'Comisión PayPal', date: 'Ayer', amount: '-$45', positive: false },
    { name: 'Pago de Carlos López', date: 'Ayer', amount: '+$2,100', positive: true }
  ]

  return (
    <DashboardContainer>
      <Title>
        <BarChart3 size={32} />
        Dashboard Analytics
      </Title>

      <StatsGrid>
        {stats.map((stat, index) => (
          <StatCard key={index}>
            <StatHeader>
              <StatIcon bg={stat.bg}>
                {stat.icon}
              </StatIcon>
            </StatHeader>
            <StatValue>{stat.value}</StatValue>
            <StatLabel>{stat.label}</StatLabel>
            <StatChange positive={stat.positive}>
              {stat.change} desde el mes pasado
            </StatChange>
          </StatCard>
        ))}
      </StatsGrid>

      <ChartsSection>
        <ChartCard>
          <ChartTitle>
            <TrendingUp size={20} />
            Ingresos por Mes
          </ChartTitle>
          <ChartPlaceholder>
            Gráfico de ingresos mensuales
          </ChartPlaceholder>
        </ChartCard>

        <ChartCard>
          <ChartTitle>
            <BarChart3 size={20} />
            Métodos de Pago
          </ChartTitle>
          <ChartPlaceholder>
            Distribución de métodos
          </ChartPlaceholder>
        </ChartCard>
      </ChartsSection>

      <RecentTransactions>
        <ChartTitle>
          <Activity size={20} />
          Transacciones Recientes
        </ChartTitle>
        {recentTransactions.map((transaction, index) => (
          <TransactionItem key={index}>
            <TransactionInfo>
              <TransactionName>{transaction.name}</TransactionName>
              <TransactionDate>{transaction.date}</TransactionDate>
            </TransactionInfo>
            <TransactionAmount positive={transaction.positive}>
              {transaction.amount}
            </TransactionAmount>
          </TransactionItem>
        ))}
      </RecentTransactions>
    </DashboardContainer>
  )
}

export default Dashboard