'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.log('Error conectando a Supabase:', error)
      } else {
        console.log('Conexión exitosa con Supabase')
      }
    }
    testConnection()
  }, [])

  return (
    <div>
      <h1>Circl</h1>
      <p>Conexión a Supabase activa. Revisá la consola del navegador.</p>
    </div>
  )
}