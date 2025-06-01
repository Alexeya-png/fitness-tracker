"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useEffect, useState } from "react"

interface StatisticsDashboardProps {
  historyData: any[]
  userProfile: any
  onDeleteEntry: (entryId: string) => void
}

export function StatisticsDashboard({ historyData, userProfile, onDeleteEntry }: StatisticsDashboardProps) {
  const [mounted, setMounted] = useState(false)

  // Move this function to the top, after the mounted state
  const getMealTimeName = (mealTime: string): string => {
    switch (mealTime) {
      case "morning":
        return "Ранок"
      case "afternoon":
        return "День"
      case "evening":
        return "Вечір"
      default:
        return "Невідомо"
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!historyData || historyData.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-lg text-muted-foreground">Немає даних для відображення статистики..</p>
        <p className="text-sm text-muted-foreground mt-2">
          Почніть відстежувати своє харчування, щоб побачити статистику.
        </p>
      </div>
    )
  }

  const groupedByDate = historyData.reduce((acc, item) => {
    const date = item.date
    if (!acc[date]) {
      acc[date] = {
        entries: [],
        date: date,
        id: date,
      }
    }
    acc[date].entries.push(item)
    return acc
  }, {})

  const dailyData = Object.values(groupedByDate)
    .map((group: any) => {
      const entries = group.entries
      const totalCalories = entries.reduce((sum: number, entry: any) => sum + entry.calories, 0)
      const totalProteins = entries.reduce((sum: number, entry: any) => sum + entry.proteins, 0)
      const totalFats = entries.reduce((sum: number, entry: any) => sum + entry.fats, 0)
      const totalCarbs = entries.reduce((sum: number, entry: any) => sum + entry.carbs, 0)
      const totalWater = entries.reduce((sum: number, entry: any) => sum + entry.water, 0)
      const anyLimitExceeded = entries.some((entry: any) => entry.limitExceeded)

      // Сохраняем оригинальные записи для отображения в таблице
      const mealEntries = entries.map((entry: any) => ({
        ...entry,
        id: entry.id || `${entry.date}_${entry.mealTime || "unknown"}`,
        mealTimeName: entry.mealTimeName || getMealTimeName(entry.mealTime) || "Весь день",
      }))

      return {
        date: group.date,
        id: group.id,
        formattedDate: mounted
          ? new Date(group.date).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })
          : group.date,
        calories: totalCalories,
        proteins: totalProteins,
        fats: totalFats,
        carbs: totalCarbs,
        water: totalWater,
        limitExceeded: anyLimitExceeded,
        mealEntries: mealEntries,
      }
    })
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Calculate averages
  const averageCalories = Math.round(dailyData.reduce((sum, item) => sum + item.calories, 0) / dailyData.length)
  const averageProteins = Math.round(dailyData.reduce((sum, item) => sum + item.proteins, 0) / dailyData.length)
  const averageFats = Math.round(dailyData.reduce((sum, item) => sum + item.fats, 0) / dailyData.length)
  const averageCarbs = Math.round(dailyData.reduce((sum, item) => sum + item.carbs, 0) / dailyData.length)
  const averageWater = Math.round(dailyData.reduce((sum, item) => sum + item.water, 0) / dailyData.length)

  const macroData = [
    { name: "Білки", value: averageProteins * 4, color: "#8884d8" }, // 4 calories per gram
    { name: "Жири", value: averageFats * 9, color: "#82ca9d" }, // 9 calories per gram
    { name: "Вуглеводи", value: averageCarbs * 4, color: "#ffc658" }, // 4 calories per gram
  ]

  const chartData = [...dailyData].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Середні калорії</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCalories} кал</div>
            <p className="text-xs text-muted-foreground mt-1">За останні {dailyData.length} дні</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Середній білок</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageProteins} г</div>
            <p className="text-xs text-muted-foreground mt-1">За останні {dailyData.length} дні</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Поточна серія</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userProfile?.streak || 0} днів</div>
            <p className="text-xs text-muted-foreground mt-1">Без перевищення калорій</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Середня вода</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageWater} мл</div>
            <p className="text-xs text-muted-foreground mt-1">За останні {dailyData.length} дні</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Калорії по днях</CardTitle>
            <CardDescription>Динаміка споживання калорій</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="formattedDate" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="calories" stroke="#8884d8" activeDot={{ r: 8 }} name="Калории" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Розподіл БЖУ</CardTitle>
            <CardDescription>Середнє розподілення макронутрієнтів</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {macroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} кал`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Макронутрієнти по дням</CardTitle>
          <CardDescription>Динаміка споживання білків, жирів і вуглеводів</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="formattedDate" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="proteins" fill="#8884d8" name="Білки (г)" />
                <Bar dataKey="fats" fill="#82ca9d" name="Жири (г)" />
                <Bar dataKey="carbs" fill="#ffc658" name="Вуглеводи (г)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Історія харчування</CardTitle>
          <CardDescription>Усі записи о харчуванні</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Дата</th>
                  <th className="text-left py-2 px-4">Прийом їжі</th>
                  <th className="text-right py-2 px-4">Калорії</th>
                  <th className="text-right py-2 px-4">Білки</th>
                  <th className="text-right py-2 px-4">Жири</th>
                  <th className="text-right py-2 px-4">Вуглеводи</th>
                  <th className="text-right py-2 px-4">Вода</th>
                  <th className="text-center py-2 px-4">Перевищення</th>
                  <th className="text-center py-2 px-4">Дії</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.flatMap((item) =>
                  item.mealEntries ? (
                    item.mealEntries.map((entry: any) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/50">
                        {mounted && <td className="py-2 px-4">{new Date(entry.date).toLocaleDateString()}</td>}
                        <td className="py-2 px-4">{entry.mealTimeName}</td>
                        <td className="text-right py-2 px-4">{entry.calories} ккал</td>
                        <td className="text-right py-2 px-4">{entry.proteins} г</td>
                        <td className="text-right py-2 px-4">{entry.fats} г</td>
                        <td className="text-right py-2 px-4">{entry.carbs} г</td>
                        <td className="text-right py-2 px-4">{entry.water} мл</td>
                        <td className="text-center py-2 px-4">
                          {entry.limitExceeded ? (
                            <span className="text-red-500">Так</span>
                          ) : (
                            <span className="text-green-500">Ні</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-4">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Видалити запис?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ви впевнені, що хочете видалити запис за {new Date(entry.date).toLocaleDateString()}(
                                  {entry.mealTimeName})? Цю дію не можна скасувати.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDeleteEntry(entry.id)}>Видалити</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      {mounted && <td className="py-2 px-4">{new Date(item.date).toLocaleDateString()}</td>}
                      <td className="py-2 px-4">Весь день</td>
                      <td className="text-right py-2 px-4">{item.calories} ккал</td>
                      <td className="text-right py-2 px-4">{item.proteins} г</td>
                      <td className="text-right py-2 px-4">{item.fats} г</td>
                      <td className="text-right py-2 px-4">{item.carbs} г</td>
                      <td className="text-right py-2 px-4">{item.water} мл</td>
                      <td className="text-center py-2 px-4">
                        {item.limitExceeded ? (
                          <span className="text-red-500">Так</span>
                        ) : (
                          <span className="text-green-500">Ні</span>
                        )}
                      </td>
                      <td className="text-center py-2 px-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Видалити запис?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ви впевнені, що хочете видалити запис за {new Date(item.date).toLocaleDateString()}? Цю
                                дію не можна скасувати.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Скасувати</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDeleteEntry(item.id)}>Видалити</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
