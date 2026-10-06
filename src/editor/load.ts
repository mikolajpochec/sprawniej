/** The editor's code arrives separately (it's the biggest part of the app). Asking twice downloads it once. */
export const loadEditor = () => import('./Editor')

/** start downloading the editor in the background */
export const preloadEditor = () => void loadEditor()
