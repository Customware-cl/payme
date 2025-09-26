import React from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { CreditCard, Home, BarChart3 } from 'lucide-react'

const HeaderContainer = styled.header`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 1rem 2rem;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
`

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
`

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: bold;
  color: #667eea;
  text-decoration: none;
`

const NavLinks = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;

  @media (max-width: 768px) {
    gap: 1rem;
  }
`

const NavLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  color: #4a5568;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    background: #f7fafc;
    color: #667eea;
    transform: translateY(-1px);
  }
`

function Header() {
  return (
    <HeaderContainer>
      <Nav>
        <Logo to="/">
          <CreditCard size={24} />
          PayMe
        </Logo>
        <NavLinks>
          <NavLink to="/">
            <Home size={18} />
            Inicio
          </NavLink>
          <NavLink to="/payment">
            <CreditCard size={18} />
            Pagar
          </NavLink>
          <NavLink to="/dashboard">
            <BarChart3 size={18} />
            Dashboard
          </NavLink>
        </NavLinks>
      </Nav>
    </HeaderContainer>
  )
}

export default Header