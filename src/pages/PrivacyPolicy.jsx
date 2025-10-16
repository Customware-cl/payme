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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.95rem;
`

const Th = styled.th`
  background: #f7fafc;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #2d3748;
  border: 1px solid #e2e8f0;
`

const Td = styled.td`
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  color: #4a5568;
`

function PrivacyPolicy() {
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
        <Title>Política de Privacidad</Title>
        <Subtitle>Última actualización: {lastUpdate}</Subtitle>
      </Header>

      <Content>
        <Section>
          <Paragraph>
            En SomosPayme, respetamos tu privacidad y estamos comprometidos con la protección de tus datos personales.
            Esta política explica qué información recopilamos, cómo la usamos y tus derechos.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>1. Responsable del Tratamiento de Datos</SectionTitle>
          <Paragraph>
            <strong>Razón Social:</strong> Somos PayME SpA<br />
            <strong>Dirección:</strong> Avenida Punta Nogales 1377, casa 23, Huechuraba, Chile<br />
            <strong>Email de contacto:</strong> contacto@somospayme.cl
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>2. Datos que Recopilamos</SectionTitle>
          <Paragraph>
            Para brindarte nuestro servicio, recopilamos la siguiente información:
          </Paragraph>

          <Table>
            <thead>
              <tr>
                <Th>Tipo de Dato</Th>
                <Th>Propósito</Th>
                <Th>Base Legal</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td><strong>Nombre</strong></Td>
                <Td>Identificación del usuario y personalización del servicio</Td>
                <Td>Consentimiento y ejecución del contrato</Td>
              </tr>
              <tr>
                <Td><strong>Número de teléfono</strong></Td>
                <Td>Envío de recordatorios por WhatsApp</Td>
                <Td>Consentimiento y ejecución del contrato</Td>
              </tr>
              <tr>
                <Td><strong>Información de préstamos</strong></Td>
                <Td>Registro y gestión de préstamos personales</Td>
                <Td>Ejecución del contrato</Td>
              </tr>
              <tr>
                <Td><strong>Historial de mensajes</strong></Td>
                <Td>Seguimiento de recordatorios enviados</Td>
                <Td>Interés legítimo</Td>
              </tr>
            </tbody>
          </Table>
        </Section>

        <Section>
          <SectionTitle>3. Cómo Usamos tus Datos</SectionTitle>
          <Paragraph>
            Utilizamos tu información personal para:
          </Paragraph>
          <List>
            <ListItem>Proveer y mantener nuestro servicio de gestión de préstamos</ListItem>
            <ListItem>Enviar recordatorios automáticos por WhatsApp según tu configuración</ListItem>
            <ListItem>Procesar tus suscripciones de pago (si aplica)</ListItem>
            <ListItem>Mejorar nuestro servicio mediante análisis de uso anónimo</ListItem>
            <ListItem>Contactarte sobre actualizaciones importantes del servicio</ListItem>
            <ListItem>Cumplir con obligaciones legales</ListItem>
          </List>
        </Section>

        <Section>
          <SectionTitle>4. Compartición de Datos con Terceros</SectionTitle>
          <Paragraph>
            Para operar nuestro servicio, compartimos datos con los siguientes proveedores:
          </Paragraph>

          <Table>
            <thead>
              <tr>
                <Th>Proveedor</Th>
                <Th>Servicio</Th>
                <Th>Datos Compartidos</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td><strong>WhatsApp (Meta)</strong></Td>
                <Td>Envío de mensajes y recordatorios</Td>
                <Td>Número de teléfono, contenido de recordatorios</Td>
              </tr>
              <tr>
                <Td><strong>Supabase</strong></Td>
                <Td>Almacenamiento de base de datos</Td>
                <Td>Nombre, teléfono, información de préstamos</Td>
              </tr>
            </tbody>
          </Table>

          <Paragraph>
            <strong>Importante:</strong> No vendemos ni alquilamos tus datos personales a terceros.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>5. Almacenamiento y Seguridad</SectionTitle>
          <Paragraph>
            Tus datos se almacenan de forma segura utilizando:
          </Paragraph>
          <List>
            <ListItem>Cifrado de datos en tránsito (HTTPS/TLS)</ListItem>
            <ListItem>Cifrado de datos en reposo en nuestras bases de datos</ListItem>
            <ListItem>Autenticación segura y control de acceso</ListItem>
            <ListItem>Políticas de seguridad RLS (Row Level Security) en Supabase</ListItem>
          </List>
          <Paragraph>
            Los datos se almacenan en servidores ubicados en la nube (Supabase), con respaldos automáticos.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>6. Retención de Datos</SectionTitle>
          <Paragraph>
            Conservamos tus datos personales mientras:
          </Paragraph>
          <List>
            <ListItem>Tu cuenta esté activa</ListItem>
            <ListItem>Sea necesario para cumplir con nuestras obligaciones legales</ListItem>
            <ListItem>Existan préstamos activos o pendientes registrados en tu cuenta</ListItem>
          </List>
          <Paragraph>
            Puedes solicitar la eliminación de tu cuenta y datos en cualquier momento, sujeto a requisitos legales de retención.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>7. Tus Derechos</SectionTitle>
          <Paragraph>
            Conforme a la Ley N° 19.628 sobre Protección de Datos Personales de Chile, tienes derecho a:
          </Paragraph>
          <List>
            <ListItem><strong>Acceso:</strong> Solicitar copia de tus datos personales</ListItem>
            <ListItem><strong>Rectificación:</strong> Corregir datos inexactos o incompletos</ListItem>
            <ListItem><strong>Eliminación:</strong> Solicitar la eliminación de tus datos (derecho al olvido)</ListItem>
            <ListItem><strong>Oposición:</strong> Oponerte al procesamiento de tus datos</ListItem>
            <ListItem><strong>Portabilidad:</strong> Recibir tus datos en formato estructurado</ListItem>
            <ListItem><strong>Revocación:</strong> Retirar tu consentimiento en cualquier momento</ListItem>
          </List>
          <Paragraph>
            Para ejercer estos derechos, contáctanos en: <strong>contacto@somospayme.cl</strong>
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>8. Uso de WhatsApp</SectionTitle>
          <Paragraph>
            Nuestro servicio utiliza WhatsApp Business API. Al usar SomosPayme:
          </Paragraph>
          <List>
            <ListItem>Autorizas el envío de mensajes a tu número de WhatsApp</ListItem>
            <ListItem>Puedes optar por no recibir mensajes (opt-out) respondiendo "STOP" o desde tu perfil</ListItem>
            <ListItem>Los mensajes están sujetos a la política de privacidad de WhatsApp/Meta</ListItem>
          </List>
        </Section>

        <Section>
          <SectionTitle>9. Cookies y Tecnologías de Seguimiento</SectionTitle>
          <Paragraph>
            Actualmente, SomosPayme no utiliza cookies de terceros para seguimiento publicitario.
            Podemos usar cookies técnicas necesarias para el funcionamiento del servicio.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>10. Menores de Edad</SectionTitle>
          <Paragraph>
            Nuestro servicio no está dirigido a menores de 18 años. No recopilamos intencionalmente
            información de menores. Si detectamos que un menor ha proporcionado datos, los eliminaremos inmediatamente.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>11. Transferencias Internacionales</SectionTitle>
          <Paragraph>
            Algunos de nuestros proveedores (Supabase, WhatsApp) pueden procesar datos fuera de Chile.
            Garantizamos que estas transferencias cumplen con estándares de protección adecuados.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>12. Cambios a esta Política</SectionTitle>
          <Paragraph>
            Podemos actualizar esta política ocasionalmente. Te notificaremos cambios significativos
            por email o mediante un aviso destacado en el servicio. El uso continuado del servicio
            implica aceptación de los cambios.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>13. Contacto</SectionTitle>
          <Paragraph>
            Para preguntas sobre esta política de privacidad o el tratamiento de tus datos, contáctanos en:
          </Paragraph>
          <Paragraph>
            <strong>Email:</strong> contacto@somospayme.cl<br />
            <strong>Dirección:</strong> Avenida Punta Nogales 1377, casa 23, Huechuraba, Chile<br />
            <strong>WhatsApp:</strong> +56 9 4087 0738
          </Paragraph>
        </Section>
      </Content>
    </Container>
  )
}

export default PrivacyPolicy
