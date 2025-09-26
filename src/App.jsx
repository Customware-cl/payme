import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import styled from 'styled-components'
import Header from './components/Header'
import Home from './pages/Home'
import Payment from './pages/Payment'
import Dashboard from './pages/Dashboard'

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`

const MainContent = styled.main`
  min-height: calc(100vh - 80px);
  padding: 2rem;
`

function App() {
  return (
    <Router>
      <AppContainer>
        <Header />
        <MainContent>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </MainContent>
      </AppContainer>
    </Router>
  )
}

export default App