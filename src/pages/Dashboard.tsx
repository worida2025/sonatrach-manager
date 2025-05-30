
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Database, Upload, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

const Dashboard = () => {
  const stats = [
    {
      title: "Total PIDs",
      value: "24",
      description: "+3 this week",
      icon: FileText,
      color: "text-blue-600"
    },
    {
      title: "Total Datasheets", 
      value: "156",
      description: "+12 this week",
      icon: Database,
      color: "text-green-600"
    },
    {
      title: "Processed Today",
      value: "8",
      description: "+2 from yesterday",
      icon: Upload,
      color: "text-orange-600"
    },
    {
      title: "Success Rate",
      value: "97.3%",
      description: "+0.5% this month",
      icon: TrendingUp,
      color: "text-purple-600"
    }
  ]

  const recentActivity = [
    { type: 'PID', name: 'Process_Flow_Rev_C.pdf', time: '2 hours ago', status: 'processed' },
    { type: 'Datasheet', name: 'Motor_Specs_ABC123.pdf', time: '4 hours ago', status: 'processed' },
    { type: 'PID', name: 'Control_System_Layout.pdf', time: '1 day ago', status: 'processed' },
    { type: 'Datasheet', name: 'Pump_Technical_Data.pdf', time: '2 days ago', status: 'processed' }
  ]

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Data Navigator Dashboard</h1>
          <p className="text-muted-foreground">Manage your technical documents and data extraction workflows</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Process & Instrumentation Diagrams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Upload and manage PID documents with automated data extraction
            </p>
            <Button asChild className="w-full">
              <Link to="/pid">
                Go to PID Manager
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Technical Datasheets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Upload and manage equipment datasheets with specification extraction
            </p>
            <Button asChild className="w-full">
              <Link to="/datasheets">
                Go to Datasheets Manager
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {item.type === 'PID' ? (
                    <FileText className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Database className="h-4 w-4 text-green-600" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                  <div className="text-xs">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800">
                      {item.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
