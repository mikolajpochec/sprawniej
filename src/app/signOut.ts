import { useData, EMPTY } from '@/data/store'
import { resetProjection } from '@/data/project'
import { useSession } from '@/session'
import { setWorkspace } from '@/sync/engine'
import { wipeAllCopies } from '@/sync/local'

/** Forget the key and every workspace copy in this browser, then start over at the welcome screen. */
export async function signOutEverywhere() {
  setWorkspace(null)
  await wipeAllCopies()
  resetProjection()
  useData.setState({ ...EMPTY })
  useSession.getState().signOut()
  localStorage.removeItem('sprawniej-displays')
  location.hash = '#/'
  location.reload() // closes the open databases so the wipe can finish
}
