import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError() { return {failed:true} }
  componentDidCatch(error:Error,info:ErrorInfo) { console.error('SmartRail interface error',error.message,info.componentStack) }
  render() {
    if(this.state.failed)return <main className="fatal-state" role="alert"><div className="eyebrow">SMART RAIL / RECOVERY</div><h1>This view could not be displayed</h1><p>Your saved data is unchanged. Reload the app to try again.</p><button className="button primary" onClick={()=>window.location.reload()}>Reload application</button></main>
    return this.props.children
  }
}
