import React, { useState } from 'react'
import styled from 'styled-components'
import { useForm } from 'react-hook-form'
import { CreditCard, Lock, Check } from 'lucide-react'

const PaymentContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
`

const Title = styled.h1`
  text-align: center;
  color: #2d3748;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const Label = styled.label`
  font-weight: 600;
  color: #4a5568;
`

const Input = styled.input`
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &:invalid {
    border-color: #e53e3e;
  }
`

const Select = styled.select`
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`

const CardRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
`

const PayButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`

const SecurityNote = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #4a5568;
  font-size: 0.9rem;
  background: #f7fafc;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
`

const SuccessMessage = styled.div`
  background: #c6f6d5;
  border: 1px solid #68d391;
  color: #2f855a;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`

function Payment() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const onSubmit = async (data) => {
    setIsProcessing(true)

    // Simular procesamiento de pago
    await new Promise(resolve => setTimeout(resolve, 2000))

    setIsProcessing(false)
    setIsSuccess(true)

    console.log('Datos del pago:', data)
  }

  if (isSuccess) {
    return (
      <PaymentContainer>
        <SuccessMessage>
          <Check size={24} />
          ¡Pago procesado exitosamente!
        </SuccessMessage>
      </PaymentContainer>
    )
  }

  return (
    <PaymentContainer>
      <Title>
        <CreditCard size={28} />
        Procesar Pago
      </Title>

      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormGroup>
          <Label>Monto a Pagar</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            {...register('amount', { required: true, min: 0.01 })}
          />
        </FormGroup>

        <FormGroup>
          <Label>Moneda</Label>
          <Select {...register('currency', { required: true })}>
            <option value="CLP">CLP - Peso Chileno</option>
            <option value="USD">USD - Dólar Americano</option>
            <option value="EUR">EUR - Euro</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Número de Tarjeta</Label>
          <Input
            type="text"
            placeholder="1234 5678 9012 3456"
            maxLength="19"
            {...register('cardNumber', {
              required: true,
              pattern: /^[0-9\s]{13,19}$/
            })}
          />
        </FormGroup>

        <CardRow>
          <FormGroup>
            <Label>Fecha de Vencimiento</Label>
            <Input
              type="text"
              placeholder="MM/YY"
              maxLength="5"
              {...register('expiry', {
                required: true,
                pattern: /^(0[1-9]|1[0-2])\/\d{2}$/
              })}
            />
          </FormGroup>
          <FormGroup>
            <Label>CVV</Label>
            <Input
              type="text"
              placeholder="123"
              maxLength="4"
              {...register('cvv', {
                required: true,
                pattern: /^\d{3,4}$/
              })}
            />
          </FormGroup>
        </CardRow>

        <FormGroup>
          <Label>Nombre del Titular</Label>
          <Input
            type="text"
            placeholder="Juan Pérez"
            {...register('cardholderName', { required: true })}
          />
        </FormGroup>

        <PayButton type="submit" disabled={isProcessing}>
          {isProcessing ? (
            'Procesando...'
          ) : (
            <>
              <Lock size={20} />
              Pagar Seguro
            </>
          )}
        </PayButton>

        <SecurityNote>
          <Lock size={16} />
          Todos los datos están protegidos con cifrado SSL de 256 bits
        </SecurityNote>
      </Form>
    </PaymentContainer>
  )
}

export default Payment