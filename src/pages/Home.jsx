import React from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { MessageCircle, Bell, CheckCircle, Clock, Shield, Users, ArrowRight, Smartphone } from 'lucide-react'

const HomeContainer = styled.div`
  width: 100%;
  overflow-x: hidden;
`

const Hero = styled.section`
  position: relative;
  padding: 6rem 2rem 4rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.4;
  }

  @media (max-width: 768px) {
    padding: 4rem 1.5rem 3rem;
  }
`

const HeroContent = styled.div`
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  z-index: 1;
`

const Badge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 0.5rem 1.5rem;
  border-radius: 50px;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
`

const Title = styled.h1`
  font-size: 4rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  line-height: 1.1;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }

  @media (max-width: 480px) {
    font-size: 2rem;
  }
`

const Subtitle = styled.p`
  font-size: 1.35rem;
  margin-bottom: 3rem;
  opacity: 0.95;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.7;

  @media (max-width: 768px) {
    font-size: 1.15rem;
  }
`

const CTAContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
`

const CTAButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  color: #667eea;
  padding: 1.25rem 2.5rem;
  border-radius: 50px;
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
  }

  @media (max-width: 768px) {
    padding: 1rem 2rem;
    font-size: 1rem;
  }
`

const SecondaryButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: transparent;
  color: white;
  padding: 1.25rem 2.5rem;
  border-radius: 50px;
  font-weight: 600;
  font-size: 1.1rem;
  text-decoration: none;
  transition: all 0.3s ease;
  border: 2px solid rgba(255, 255, 255, 0.3);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
  }

  @media (max-width: 768px) {
    padding: 1rem 2rem;
    font-size: 1rem;
  }
`

const Section = styled.section`
  padding: 5rem 2rem;
  background: ${props => props.bg || 'white'};

  @media (max-width: 768px) {
    padding: 3rem 1.5rem;
  }
`

const SectionContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`

const SectionTitle = styled.h2`
  font-size: 2.75rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 1rem;
  color: #2d3748;

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`

const SectionSubtitle = styled.p`
  font-size: 1.15rem;
  text-align: center;
  color: #64748b;
  margin-bottom: 4rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
`

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2.5rem;
  margin-top: 3rem;

  @media (max-width: 768px) {
    gap: 2rem;
  }
`

const FeatureCard = styled.div`
  text-align: center;
  padding: 2.5rem 2rem;
  border-radius: 20px;
  background: white;
  border: 2px solid #f1f5f9;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 60px rgba(102, 126, 234, 0.15);
    border-color: #667eea;
  }
`

const FeatureIcon = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;

  svg {
    width: 50px;
    height: 50px;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 15px;
  }
`

const FeatureTitle = styled.h3`
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: #2d3748;
`

const FeatureDescription = styled.p`
  color: #64748b;
  line-height: 1.7;
  font-size: 1rem;
`

const StepsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
  position: relative;

  @media (min-width: 769px) {
    &::before {
      content: '';
      position: absolute;
      top: 50px;
      left: 20%;
      right: 20%;
      height: 2px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      opacity: 0.2;
      z-index: 0;
    }
  }
`

const StepCard = styled.div`
  text-align: center;
  padding: 2rem 1.5rem;
  position: relative;
  z-index: 1;
`

const StepNumber = styled.div`
  width: 60px;
  height: 60px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 800;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
`

const StepTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: #2d3748;
`

const StepDescription = styled.p`
  color: #64748b;
  line-height: 1.6;
  font-size: 0.95rem;
`

const StatsSection = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 3rem;
  margin-top: 4rem;
  padding-top: 4rem;
  border-top: 2px solid #f1f5f9;
`

const StatCard = styled.div`
  text-align: center;
`

const StatNumber = styled.div`
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.5rem;
`

const StatLabel = styled.div`
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
`

const Footer = styled.footer`
  background: #1a202c;
  color: white;
  padding: 3rem 2rem 2rem;
`

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    text-align: center;
  }
`

const FooterSection = styled.div``

const FooterTitle = styled.h4`
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: white;
`

const FooterText = styled.p`
  font-size: 0.95rem;
  line-height: 1.6;
  color: #a0aec0;
  margin-bottom: 0.5rem;
`

const FooterLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const FooterLink = styled(Link)`
  color: #a0aec0;
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.3s ease;

  &:hover {
    color: white;
  }
`

const FooterBottom = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 2rem;
  border-top: 1px solid #2d3748;
  text-align: center;
  color: #a0aec0;
  font-size: 0.9rem;
`

const SocialLinks = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;

  @media (max-width: 768px) {
    justify-content: center;
  }
`

const SocialLink = styled.a`
  color: #a0aec0;
  transition: color 0.3s ease;

  &:hover {
    color: white;
  }
`

function Home() {
  const features = [
    {
      icon: <Smartphone />,
      title: 'Registro en Segundos',
      description: 'Registra préstamos directamente desde WhatsApp de forma rápida y sencilla, sin formularios complicados.'
    },
    {
      icon: <Bell />,
      title: 'Recordatorios Automáticos',
      description: 'El sistema envía recordatorios inteligentes antes y durante el vencimiento. Nunca olvides cobrar.'
    },
    {
      icon: <CheckCircle />,
      title: 'Confirmación del Deudor',
      description: 'Tu contacto confirma el préstamo. Todo queda registrado y validado por ambas partes.'
    },
    {
      icon: <Clock />,
      title: 'Gestión de Vencimientos',
      description: 'Visualiza todos tus préstamos pendientes, vencidos y completados en un solo lugar.'
    },
    {
      icon: <Shield />,
      title: 'Seguro y Privado',
      description: 'Tus datos están protegidos con cifrado de extremo a extremo y cumplimos políticas de WhatsApp.'
    },
    {
      icon: <Users />,
      title: 'Para Todos',
      description: 'Presta dinero a amigos, familia o clientes. Gestiona múltiples préstamos sin complicaciones.'
    }
  ]

  const steps = [
    {
      number: '1',
      title: 'Inicia Conversación',
      description: 'Envía "Hola" al bot de WhatsApp y selecciona "Nuevo préstamo"'
    },
    {
      number: '2',
      title: 'Registra el Préstamo',
      description: 'Indica a quién, cuánto y cuándo debe devolver'
    },
    {
      number: '3',
      title: 'Confirmación',
      description: 'Tu contacto recibe y confirma el préstamo automáticamente'
    },
    {
      number: '4',
      title: 'Relájate',
      description: 'Recibe recordatorios automáticos hasta que sea devuelto'
    }
  ]

  // En producción, estos valores vendrían de tu backend
  const stats = [
    { number: '500+', label: 'Préstamos Registrados' },
    { number: '98%', label: 'Tasa de Devolución' },
    { number: '24/7', label: 'Disponibilidad' }
  ]

  return (
    <HomeContainer>
      <Hero>
        <HeroContent>
          <Badge>
            <MessageCircle size={16} />
            100% vía WhatsApp
          </Badge>
          <Title>Lleva el Control de tus Préstamos</Title>
          <Subtitle>
            Registra y gestiona préstamos a amigos, familia o clientes con recordatorios automáticos por WhatsApp. Simple, seguro y efectivo.
          </Subtitle>
          <CTAContainer>
            <CTAButton href="https://wa.me/56940870738?text=Hola" target="_blank" rel="noopener noreferrer">
              <MessageCircle size={22} />
              Comenzar por WhatsApp
            </CTAButton>
            <SecondaryButton href="/menu">
              Ver mis Préstamos
              <ArrowRight size={20} />
            </SecondaryButton>
          </CTAContainer>
        </HeroContent>
      </Hero>

      <Section bg="#fafbfc">
        <SectionContent>
          <SectionTitle>¿Por qué usar SomosPayme?</SectionTitle>
          <SectionSubtitle>
            Deja de olvidar cobrar. Automatiza tus recordatorios y mantén el control de todos tus préstamos.
          </SectionSubtitle>
          <FeaturesGrid>
            {features.map((feature, index) => (
              <FeatureCard key={index}>
                <FeatureIcon>{feature.icon}</FeatureIcon>
                <FeatureTitle>{feature.title}</FeatureTitle>
                <FeatureDescription>{feature.description}</FeatureDescription>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </SectionContent>
      </Section>

      <Section bg="white">
        <SectionContent>
          <SectionTitle>Cómo Funciona</SectionTitle>
          <SectionSubtitle>
            Cuatro pasos simples para nunca más olvidar un préstamo
          </SectionSubtitle>
          <StepsGrid>
            {steps.map((step, index) => (
              <StepCard key={index}>
                <StepNumber>{step.number}</StepNumber>
                <StepTitle>{step.title}</StepTitle>
                <StepDescription>{step.description}</StepDescription>
              </StepCard>
            ))}
          </StepsGrid>
          <StatsSection>
            {stats.map((stat, index) => (
              <StatCard key={index}>
                <StatNumber>{stat.number}</StatNumber>
                <StatLabel>{stat.label}</StatLabel>
              </StatCard>
            ))}
          </StatsSection>
        </SectionContent>
      </Section>

      <Section bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
        <SectionContent style={{ textAlign: 'center', color: 'white' }}>
          <SectionTitle style={{ color: 'white', marginBottom: '1.5rem' }}>
            Comienza Hoy Mismo
          </SectionTitle>
          <Subtitle style={{ marginBottom: '2.5rem', maxWidth: '600px' }}>
            Únete a cientos de personas que ya están gestionando sus préstamos de forma inteligente
          </Subtitle>
          <CTAButton href="https://wa.me/56940870738?text=Hola" target="_blank" rel="noopener noreferrer">
            <MessageCircle size={22} />
            Abrir WhatsApp
          </CTAButton>
        </SectionContent>
      </Section>

      <Footer>
        <FooterContent>
          <FooterSection>
            <FooterTitle>SomosPayme</FooterTitle>
            <FooterText>
              Gestiona tus préstamos personales con recordatorios automáticos por WhatsApp.
            </FooterText>
            <FooterText>
              Simple, seguro y efectivo.
            </FooterText>
          </FooterSection>

          <FooterSection>
            <FooterTitle>Legal</FooterTitle>
            <FooterLinks>
              <FooterLink to="/terms">Términos y Condiciones</FooterLink>
              <FooterLink to="/privacy">Política de Privacidad</FooterLink>
            </FooterLinks>
          </FooterSection>

          <FooterSection>
            <FooterTitle>Contacto</FooterTitle>
            <FooterText>contacto@somospayme.cl</FooterText>
            <FooterText>Huechuraba, Santiago, Chile</FooterText>
            <SocialLinks>
              <SocialLink href="https://wa.me/56940870738" target="_blank" rel="noopener noreferrer">
                <MessageCircle size={20} />
              </SocialLink>
            </SocialLinks>
          </FooterSection>
        </FooterContent>

        <FooterBottom>
          © {new Date().getFullYear()} Somos PayME SpA. Todos los derechos reservados.
        </FooterBottom>
      </Footer>
    </HomeContainer>
  )
}

export default Home