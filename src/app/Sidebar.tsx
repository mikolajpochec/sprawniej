/** The left column: product name, personal pages, workspace pages, your teams, and you at the bottom. */
import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { ChevronDown, ChevronsUpDown, CircleHelp, CircleUser, Inbox, Layers, LogOut, Box, SquareStack, Repeat } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Logo } from '@/components/Logo'
import { PersonAvatar } from '@/components/Avatar'
import { useData } from '@/data/store'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu'

function NavItem({ href, icon, children, count, indent }: { href: string; icon: ReactNode; children: ReactNode; count?: number; indent?: boolean }) {
  const [location] = useLocation()
  const active = location === href || (href !== '/' && location.startsWith(`${href}/`))
  return (
    <Link
      href={href}
      className={cn(
        'flex h-9 items-center gap-3 rounded-lg px-3 text-[15px] text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent/60 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-sidebar-foreground/80',
        active && 'bg-sidebar-accent text-sidebar-foreground',
        indent && 'pl-9',
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {!!count && <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">{count}</span>}
    </Link>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-1 px-3 text-[13px] font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

function TeamGroup({ teamKey }: { teamKey: string }) {
  const team = useData((s) => s.teams[teamKey])
  const [open, setOpen] = useState(true)
  if (!team) return null
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-sidebar-foreground/90 hover:bg-sidebar-accent/60"
      >
        <span className="w-[18px] text-center text-base leading-none">{team.emoji}</span>
        <span className="truncate">{team.name}</span>
        <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5">
          <NavItem indent href={`/team/${team.key}/issues`} icon={<SquareStack />}>
            Issues
          </NavItem>
          <NavItem indent href={`/team/${team.key}/projects`} icon={<Box />}>
            Projects
          </NavItem>
          <NavItem indent href={`/team/${team.key}/views`} icon={<Layers />}>
            Views
          </NavItem>
        </div>
      )}
    </div>
  )
}

function Me() {
  const me = useData((s) => s.me)
  const workspace = useData((s) => s.workspace)
  if (!me) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50">
        <PersonAvatar person={me} className="size-10 text-sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{me.name}</span>
          <span className="block truncate text-[13px] text-muted-foreground">@{me.login}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Workspace: {workspace?.name}</div>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <CircleHelp /> Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Repeat /> Switch workspace
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <CircleUser /> Your GitHub profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Sidebar() {
  const myTeams = useData(useShallow((s) => Object.values(s.teams).filter((t) => !s.me || t.members.includes(s.me.login)).map((t) => t.key)))
  const unread = useData((s) => s.inbox.filter((n) => !s.readState.read.includes(n.id) && (!s.readState.readUntil || n.at > s.readState.readUntil)).length)
  return (
    <aside className="flex h-full w-[17.5rem] shrink-0 flex-col border-r bg-sidebar">
      <Link href="/" className="flex h-16 items-center gap-3 px-5 text-xl font-semibold tracking-tight">
        <Logo />
        Sprawniej
      </Link>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="mt-2 flex flex-col gap-0.5">
          <NavItem href="/inbox" icon={<Inbox />} count={unread}>
            Inbox
          </NavItem>
          <NavItem href="/my-issues" icon={<CircleUser />}>
            My issues
          </NavItem>
        </div>
        <Section title="Workspace">
          <NavItem href="/projects" icon={<Box />}>
            Projects
          </NavItem>
          <NavItem href="/views" icon={<Layers />}>
            Views
          </NavItem>
        </Section>
        <Section title="Your teams">
          {myTeams.map((key) => (
            <TeamGroup key={key} teamKey={key} />
          ))}
        </Section>
      </nav>
      <div className="border-t p-2">
        <Me />
      </div>
    </aside>
  )
}
