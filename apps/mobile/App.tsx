// SKIDS Screen V3 — React Native entry point
import React from 'react'
import { HomeScreen } from './src/screens/HomeScreen'
import { StatusBar } from 'expo-status-bar'

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <HomeScreen />
    </>
  )
}
