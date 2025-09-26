import React from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { CreditCard, Shield, Zap, Globe } from 'lucide-react'

const HomeContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
`

const Hero = styled.section`
  padding: 4rem 0;
  color: white;
`

const Title = styled.h1`
  font-size: 3.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`

const Subtitle = styled.p`
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
`

const CTAButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  color: #667eea;
  padding: 1rem 2rem;
  border-radius: 50px;
  font-weight: bold;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3);
  }
`

const Features = styled.section`
  background: white;
  padding: 4rem 2rem;
  margin: 2rem 0;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
`

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
`

const FeatureCard = styled.div`
  text-align: center;
  padding: 2rem;
  border-radius: 15px;
  background: #f8fafc;
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-5px);
  }
`

const FeatureIcon = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  color: #667eea;
`

const FeatureTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: #2d3748;
`

const FeatureDescription = styled.p`
  color: #4a5568;
  line-height: 1.6;
`

function Home() {
  const features = [
    {
      icon: <Shield size={40} />,
      title: 'Seguridad Máxima',
      description: 'Cifrado de extremo a extremo y protección de datos bancaria'
    },
    {
      icon: <Zap size={40} />,
      title: 'Pagos Instantáneos',
      description: 'Transacciones en tiempo real con confirmación inmediata'
    },
    {
      icon: <Globe size={40} />,
      title: 'Global',
      description: 'Acepta pagos desde cualquier parte del mundo'
    }
  ]

  return (
    <HomeContainer>
      <Hero>
        <Title>Pagos Seguros y Rápidos</Title>
        <Subtitle>
          La plataforma de pagos más confiable para tu negocio.
          Procesa transacciones de forma segura y eficiente.
        </Subtitle>
        <CTAButton to="/payment">
          <CreditCard size={20} />
          Comenzar Ahora
        </CTAButton>
      </Hero>

      <Features>
        <Title style={{ color: '#2d3748', fontSize: '2.5rem', textShadow: 'none' }}>
          ¿Por qué elegir PayMe?
        </Title>
        <FeaturesGrid>
          {features.map((feature, index) => (
            <FeatureCard key={index}>
              <FeatureIcon>{feature.icon}</FeatureIcon>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.description}</FeatureDescription>
            </FeatureCard>
          ))}
        </FeaturesGrid>
      </Features>
    </HomeContainer>
  )
}

export default Home