
import { FileText, Database, MessageCircle, Settings, LogOut, User } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

const adminMenuItems = [
  {
    title: "PID",
    url: "/pid",
    icon: FileText,
    description: "Process & Instrumentation Diagrams"
  },
  {
    title: "Datasheets",
    url: "/datasheets", 
    icon: Database,
    description: "Technical Data Sheets"
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
    description: "AI Assistant Chat"
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "System Configuration"
  }
]

const clientMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Database,
    description: "Overview"
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
    description: "AI Assistant Chat"
  }
]

export function AppSidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  
  const menuItems = user?.role === 'admin' ? adminMenuItems : clientMenuItems

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Database className="h-4 w-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Sonatrach AI Data Navigator</span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.role === 'admin' ? 'Admin Panel' : 'Client Panel'}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {user?.role === 'admin' ? 'Admin Functions' : 'Available Features'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url}
                    className="h-12"
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{item.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">{user?.username}</span>
          </div>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {user?.role}
          </span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={logout}
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
