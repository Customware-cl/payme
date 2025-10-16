import React from 'react'
import styled from 'styled-components'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const Container = styled.div`
  width: 100%;
  min-height: 100vh;
  background: white;
`

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 2rem 3rem;
  text-align: center;
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
  text-decoration: none;
  margin-bottom: 1rem;
  opacity: 0.9;
  transition: opacity 0.3s ease;

  &:hover {
    opacity: 1;
  }
`

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`

const Subtitle = styled.p`
  font-size: 1rem;
  opacity: 0.9;
`

const Content = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 3rem 2rem;
`

const Section = styled.section`
  margin-bottom: 2.5rem;
`

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 1rem;
`

const Paragraph = styled.p`
  font-size: 1rem;
  line-height: 1.8;
  color: #4a5568;
  margin-bottom: 1rem;
`

const List = styled.ul`
  margin-left: 1.5rem;
  margin-bottom: 1rem;
`

const ListItem = styled.li`
  font-size: 1rem;
  line-height: 1.8;
  color: #4a5568;
  margin-bottom: 0.5rem;
`

function TermsOfService() {
  const lastUpdate = new Date().toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Container>
      <Header>
        <BackLink to="/">
          <ArrowLeft size={20} />
          Volver al inicio
        </BackLink>
        <Title>Términos y Condiciones de Servicio</Title>
        <Subtitle>Última actualización: {lastUpdate}</Subtitle>
      </Header>

      <Content>
        <Section>
          <Paragraph>
            Bienvenido a SomosPayme. Al utilizar nuestro servicio, usted acepta estos términos y condiciones.
            Por favor, léalos cuidadosamente.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>1. Información de la Empresa</SectionTitle>
          <Paragraph>
            <strong>Razón Social:</strong> Somos PayME SpA<br />
            <strong>Dirección:</strong> Avenida Punta Nogales 1377, casa 23, Huechuraba, Chile<br />
            <strong>Contacto:</strong> contacto@somospayme.cl
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>2. Descripción del Servicio</SectionTitle>
          <Paragraph>
            SomosPayme es una plataforma que permite a los usuarios:
          </Paragraph>
          <List>
            <ListItem>Registrar y gestionar préstamos personales entre particulares</ListItem>
            <ListItem>Recibir recordatorios automáticos por WhatsApp sobre vencimientos</ListItem>
            <ListItem>Llevar un control organizado de préstamos activos, vencidos y completados</ListItem>
            <ListItem>Registrar servicios recurrentes (funcionalidad premium)</ListItem>
          </List>
        </Section>

        <Section>
          <SectionTitle>3. Modelo Freemium</SectionTitle>
          <Paragraph>
            <strong>Servicios Gratuitos:</strong>
          </Paragraph>
          <List>
            <ListItem>Registro y gestión ilimitada de préstamos personales</ListItem>
            <ListItem>Recordatorios automáticos por WhatsApp</ListItem>
            <ListItem>Confirmación de préstamos por parte de los deudores</ListItem>
          </List>
          <Paragraph>
            <strong>Servicios de Pago (Suscripción Mensual):</strong>
          </Paragraph>
          <List>
            <ListItem>Registro de servicios recurrentes con recordatorios de pago</ListItem>
            <ListItem>Funcionalidades adicionales según el plan contratado</ListItem>
          </List>
        </Section>

        <Section>
          <SectionTitle>4. Responsabilidades del Usuario</SectionTitle>
          <Paragraph>
            Al utilizar SomosPayme, usted se compromete a:
          </Paragraph>
          <List>
            <ListItem>Proporcionar información veraz y actualizada</ListItem>
            <ListItem>Usar el servicio únicamente para fines legítimos de gestión de préstamos personales</ListItem>
            <ListItem>No utilizar la plataforma para actividades ilegales, fraude o cobranzas abusivas</ListItem>
            <ListItem>Respetar las políticas de uso de WhatsApp y no enviar spam</ListItem>
            <ListItem>Mantener la confidencialidad de su cuenta y contraseña (si aplica)</ListItem>
          </List>
        </Section>

        <Section>
          <SectionTitle>5. Limitación de Responsabilidad</SectionTitle>
          <Paragraph>
            SomosPayme actúa únicamente como una herramienta de gestión y recordatorios. La plataforma:
          </Paragraph>
          <List>
            <ListItem>NO es una institución financiera ni intermediario de crédito</ListItem>
            <ListItem>NO garantiza el pago o devolución de préstamos registrados</ListItem>
            <ListItem>NO se hace responsable de disputas entre usuarios y sus contactos</ListItem>
            <ListItem>NO proporciona asesoría legal ni financiera</ListItem>
          </List>
          <Paragraph>
            El usuario es el único responsable de sus acuerdos de préstamo con terceros.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>6. Uso de WhatsApp</SectionTitle>
          <Paragraph>
            Nuestro servicio utiliza la API de WhatsApp Business para enviar recordatorios. Al usar SomosPayme:
          </Paragraph>
          <List>
            <ListItem>Usted autoriza el envío de mensajes a través de WhatsApp</ListItem>
            <ListItem>Debe cumplir con las políticas de WhatsApp sobre comunicaciones comerciales</ListItem>
            <ListItem>Puede optar por no recibir mensajes (opt-out) en cualquier momento</ListItem>
          </List>
        </Section>

        <Section>
          <SectionTitle>7. Propiedad Intelectual</SectionTitle>
          <Paragraph>
            Todos los derechos de propiedad intelectual sobre la plataforma, diseño, código y marca "SomosPayme"
            pertenecen a Somos PayME SpA. Queda prohibida su reproducción sin autorización expresa.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>8. Modificaciones del Servicio</SectionTitle>
          <Paragraph>
            Nos reservamos el derecho de:
          </Paragraph>
          <List>
            <ListItem>Modificar, suspender o descontinuar el servicio en cualquier momento</ListItem>
            <ListItem>Actualizar estos términos y condiciones con previo aviso</ListItem>
            <ListItem>Cambiar los precios de suscripciones con 30 días de anticipación</ListItem>
          </List>
        </Section>

        <Section>
          <SectionTitle>9. Cancelación de Cuenta</SectionTitle>
          <Paragraph>
            Usted puede cancelar su cuenta en cualquier momento. SomosPayme se reserva el derecho de
            suspender o eliminar cuentas que violen estos términos.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>10. Jurisdicción y Ley Aplicable</SectionTitle>
          <Paragraph>
            Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia será
            resuelta en los tribunales ordinarios de justicia de Santiago, Chile.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>11. Contacto</SectionTitle>
          <Paragraph>
            Para consultas sobre estos términos, contáctenos en:<br />
            <strong>Email:</strong> contacto@somospayme.cl<br />
            <strong>Dirección:</strong> Avenida Punta Nogales 1377, casa 23, Huechuraba, Chile
          </Paragraph>
        </Section>
      </Content>
    </Container>
  )
}

export default TermsOfService
