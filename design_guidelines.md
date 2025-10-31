# Design Guidelines: Teams Voice Management Application

## Design Approach

**Selected System:** Microsoft Fluent Design System

**Rationale:** This enterprise admin tool integrates directly with Microsoft Azure and Teams, making Fluent Design the natural choice. Users expect Microsoft product interfaces to feel cohesive and familiar. The system provides excellent patterns for data-heavy applications, complex forms, and multi-step workflows.

**Key Design Principles:**
- Efficiency-first: Minimize clicks and cognitive load for repetitive operator tasks
- Information clarity: Dense data presentation without overwhelming users
- Progressive disclosure: Reveal complexity only when needed
- Trustworthy interaction: Clear feedback for all actions in this high-stakes environment

---

## Typography

**Font Family:** Segoe UI (native to Fluent), fallback to system fonts

**Hierarchy:**
- Page Titles: 28px, Semibold (600)
- Section Headers: 20px, Semibold (600)
- Card/Panel Titles: 16px, Semibold (600)
- Body Text: 14px, Regular (400)
- Helper/Secondary Text: 12px, Regular (400)
- Input Labels: 14px, Semibold (600)
- Button Text: 14px, Semibold (600)

---

## Layout System

**Spacing Units:** Use Tailwind units of **2, 3, 4, 6, 8, 12** for consistent rhythm
- Component padding: p-6
- Section spacing: gap-8, mb-8
- Card internal spacing: p-6
- Form field spacing: space-y-4
- Button padding: px-6 py-3
- Tight spacing for related elements: gap-2, gap-3

**Container Strategy:**
- Max-width: max-w-7xl for main content area
- Form columns: Single column max-w-2xl for optimal form completion
- Admin tables: Full width with horizontal scroll if needed
- Sidebar navigation: Fixed width w-64

---

## Component Library

### Navigation & Layout

**Top Navigation Bar:**
- Fixed header with operator identity display (name, email)
- Tenant selector dropdown (prominent placement)
- Admin menu access (icon-based, right-aligned)
- Logout button
- Height: h-16 with shadow-md for elevation

**Sidebar Navigation** (for multi-section access):
- Width: w-64
- Collapsible on mobile
- Clear active state indication
- Icons from Fluent UI Icon library via CDN

**Breadcrumbs:**
- Show navigation path: Home > Customer Tenant > User Configuration
- Spacing: gap-2 between items

### Core UI Elements

**Cards/Panels:**
- Rounded corners: rounded-lg
- Border treatment with subtle elevation
- Padding: p-6
- Header section with title and optional actions
- Use for grouping related form sections

**Buttons:**
- Primary: Solid treatment for main actions (Save, Connect, Apply)
- Secondary: Outlined treatment for secondary actions (Cancel, Back)
- Destructive: Distinct treatment for risky actions
- Height: h-11, padding: px-6
- Icon support: Leading icons for clarity (e.g., save icon + "Save Changes")

**Form Elements:**

*Text Inputs:*
- Height: h-11
- Clear label above input
- Helper text below for guidance
- Error states with inline validation messages
- Padding: px-4

*Dropdowns/Select:*
- Searchable for user selection (implement with Headless UI)
- Height: h-11 matching text inputs
- Clear selected value display
- Loading state for async data fetching
- Support for "type to search" functionality

*Radio/Checkbox:*
- Generous click targets (min 40px)
- Clear visual checked states
- Associated labels are clickable

### Data Display

**Tables (Admin Audit Log):**
- Fixed header with sorting capability
- Alternating row treatment for readability
- Column headers: Semibold, 12px uppercase with letter-spacing
- Cell padding: px-4 py-3
- Pagination controls at bottom
- Search/filter bar above table
- Columns: Operator, Tenant, Date/Time, Change Description, Status

**Status Indicators:**
- Success/Error/Warning pills with appropriate visual treatment
- Icons for at-a-glance recognition
- Small size: px-3 py-1, text-xs

**Empty States:**
- Centered messaging with helpful guidance
- Icon illustration (from Fluent Icon set)
- Clear call-to-action when applicable

### Workflows & Wizards

**Setup Wizard (App Registration):**
- Step indicator at top showing progress (1 of 4)
- Each step in dedicated card
- Clear "Next" and "Back" navigation
- Final review step before submission
- Permission list with checkboxes and explanations

**Multi-Step Forms:**
- Progressive sections that expand/collapse
- Visual completion indicators
- Sticky action bar at bottom with Save/Cancel

### Overlays

**Modal Dialogs:**
- Backdrop blur treatment
- Max-width: max-w-2xl
- Clear header with close icon
- Action buttons right-aligned at bottom
- Use for confirmations and secondary workflows

**Toast Notifications:**
- Positioned top-right
- Auto-dismiss after 5 seconds (with manual close option)
- Success/Error/Info variants
- Slide-in animation from right

**Loading States:**
- Skeleton screens for data tables
- Spinner with message for operations
- Progress bars for multi-step processes
- Disable interactive elements during loading

---

## Responsive Behavior

**Breakpoints:**
- Mobile: Base (< 768px) - Stack all elements, full-width forms
- Tablet: md (768px+) - Maintain single-column forms, introduce sidebar
- Desktop: lg (1024px+) - Full multi-column layouts, persistent sidebar

**Mobile Adaptations:**
- Hamburger menu for navigation
- Bottom sheet for dropdowns
- Full-screen modals
- Simplified table view (card-based on mobile)

---

## Interaction Patterns

**Focus Management:**
- Clear focus rings on all interactive elements
- Logical tab order through forms
- Skip-to-content link for keyboard users

**Feedback:**
- Immediate validation on blur for form fields
- Confirmation dialogs for destructive actions
- Success messages after operations complete
- Loading indicators for all async operations

**Animations:**
Use sparingly and purposefully:
- Page transitions: Subtle fade (150ms)
- Dropdown open/close: Scale and fade (200ms)
- Toast slide-in: Slide from right (250ms)
- No decorative animations - focus on functional feedback

---

## Icons

**Library:** Fluent UI Icons (via CDN)
**Usage:**
- Navigation items (16px)
- Button leading icons (16px)  
- Status indicators (14px)
- Empty states (48px)
- Consistent stroke width across all icons

---

## Accessibility

- WCAG 2.1 AA compliance minimum
- Semantic HTML throughout
- ARIA labels for icon-only buttons
- Screen reader announcements for dynamic content updates
- Keyboard navigation for all functionality
- Clear error messages associated with form fields
- Sufficient contrast ratios throughout

---

## Images

**No hero images required.** This is a utility application focused on functionality.

**Icon-based illustrations only:**
- Empty state illustrations (e.g., "No users found" with search icon graphic)
- Wizard step icons
- All from Fluent UI icon library