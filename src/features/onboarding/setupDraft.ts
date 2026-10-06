/** The name typed on "Create a new workspace", carried over to the setup screen that follows. */
const KEY = 'sprawniej-new-workspace-name'
export const rememberWorkspaceName = (name: string) => sessionStorage.setItem(KEY, name)
export const takeWorkspaceName = () => {
  const name = sessionStorage.getItem(KEY) ?? ''
  sessionStorage.removeItem(KEY)
  return name
}
