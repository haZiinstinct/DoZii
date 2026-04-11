import { ipcMain } from 'electron'
import { detectHardware } from '../services/hardware-detector.service'

export function registerHardwareIpc(): void {
  ipcMain.handle('hardware:detect', async () => {
    return detectHardware()
  })
}
