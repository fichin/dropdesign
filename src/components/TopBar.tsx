import type { Assignee } from '../../shared/kanban.ts'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  HomeIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
} from './icons'
import './TopBar.css'

interface TopBarProps {
  projectTitle: string
  members: Assignee[]
  /** The signed-in user's email (unknown while offline) */
  userEmail?: string
  onLogout: () => void
  /** Focus the board's search box */
  onSearch: () => void
}

function TopBar({ projectTitle, members, userEmail, onLogout, onSearch }: TopBarProps) {
  return (
    <header className="top-bar">
      {/* Plain text rather than links: there are no Dashboard or Project pages yet */}
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <HomeIcon className="breadcrumb-home" />
            <span className="visually-hidden">Home</span>
          </li>
          <li>
            <ChevronRightIcon className="breadcrumb-separator" />
            Dashboard
          </li>
          <li>
            <ChevronRightIcon className="breadcrumb-separator" />
            Project
          </li>
          <li aria-current="page" className="breadcrumb-current">
            <ChevronRightIcon className="breadcrumb-separator" />
            <GlobeIcon />
            {projectTitle}
          </li>
        </ol>
        {/* The mobile design swaps the trail for a back label */}
        <span className="breadcrumb-back" aria-hidden="true">
          <ChevronLeftIcon />
          Back To Project
        </span>
      </nav>

      <div className="top-bar-actions">
        <button
          type="button"
          className="icon-button"
          aria-label="Search tasks"
          title={`Search tasks (${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}+K)`}
          onClick={onSearch}
        >
          <SearchIcon />
        </button>

        <ul className="team" aria-label={`Team: ${members.length} people`}>
          {members.map((member) => (
            <li key={member.id} className="team-member">
              <img src={member.avatarUrl} alt={member.name} title={member.name} draggable={false} />
            </li>
          ))}
          {members.length > 3 && (
            <li className="team-more" aria-hidden="true">
              +{members.length - 3}
            </li>
          )}
        </ul>

        <button
          type="button"
          className="invite-button"
          // aria-disabled (not disabled) keeps it focusable so the tooltip explains why
          aria-disabled="true"
          title="Inviting people needs accounts and a shared backend — coming later"
        >
          Invite
          <PlusIcon />
        </button>

        <div className="account">
          {userEmail && (
            <span className="account-email" title={`Signed in as ${userEmail}`}>
              {userEmail}
            </span>
          )}
          <button type="button" className="logout-button" onClick={onLogout}>
            <LogoutIcon />
            <span className="logout-label">Log out</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
