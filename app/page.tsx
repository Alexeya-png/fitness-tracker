"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { auth, db } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, collection, addDoc, getDoc, query, where, orderBy, getDocs, deleteDoc } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { StatisticsDashboard } from "@/components/statistics-dashboard"
import { calculateNutrition } from "@/lib/nutrition-utils"
import { analyzeFoodWithOpenAI } from "@/lib/openai-service"

export default function FitnessTracker() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [foodAnalysisResult, setFoodAnalysisResult] = useState<string>("")
  const [foodAnalysisLoading, setFoodAnalysisLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("auth")
  const [hasEntryToday, setHasEntryToday] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  const [calculationResult, setCalculationResult] = useState<any>(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
      setLoading(false)
      if (user) {
        fetchUserProfile(user.uid)
        fetchHistory(user.uid)
        checkTodayEntry(user.uid)
        setActiveTab("statistics")
      } else {
        setActiveTab("auth")
      }
    })

    return () => unsubscribe()
  }, [currentDate])

  const fetchUserProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid))
      if (userDoc.exists()) {
        setUserProfile(userDoc.data())
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      toast({
        title: "Помилка",
        description: "Не вдалось загрузити профіль користувача",
        variant: "destructive",
      })
    }
  }

  const fetchHistory = async (uid: string) => {
    try {
      const dailyRef = collection(db, "users", uid, "daily")
      const q = query(dailyRef, orderBy("timestamp", "desc"))

      const querySnapshot = await getDocs(q)
      const history: any[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        history.push({
          ...data,
          id: doc.id,
        })
      })

      setHistoryData(history)
    } catch (error) {
      console.error("Error fetching history:", error)
      toast({
        title: "Помилка",
        description: "Не вдалось загрузити історію",
        variant: "destructive",
      })
    }
  }

  const checkTodayEntry = async (uid: string) => {
    try {
      const today = currentDate.toISOString().split("T")[0]
      const dailyRef = collection(db, "users", uid, "daily")
      const q = query(dailyRef, where("date", "==", today))

      const querySnapshot = await getDocs(q)
      setHasEntryToday(!querySnapshot.empty)
    } catch (error) {
      console.error("Error checking today entry:", error)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      setLoading(true)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await setDoc(doc(db, "users", user.uid), {
        email,
        name,
        streak: 0,
        last_date: "",
        created_at: new Date().toISOString(),
      })

      toast({
        title: "Успіх",
        description: "Акаунт створено",
      })
    } catch (error: any) {
      console.error("Error registering:", error)
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось зареєструватись",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      setLoading(true)
      await signInWithEmailAndPassword(auth, email, password)
      toast({
        title: "Успіх",
        description: "Вход успішний",
      })
    } catch (error: any) {
      console.error("Error logging in:", error)
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось увійти",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    const weightStr = formData.get("weight") as string
    const heightStr = formData.get("height") as string
    const ageStr = formData.get("age") as string
    const gender = (formData.get("gender") as string) || "male"
    const activity = (formData.get("activity") as string) || "1.2"

    console.log("Form values:", { weightStr, heightStr, ageStr, gender, activity })

    if (!weightStr || !heightStr || !ageStr) {
      toast({
        title: "Помилка",
        description: "Будь ласка, заповніть усі поля форми",
        variant: "destructive",
      })
      return
    }

    const weight = Number.parseFloat(weightStr)
    const height = Number.parseFloat(heightStr)
    const age = Number.parseInt(ageStr)
    const activityValue = Number.parseFloat(activity)

    if (isNaN(weight) || isNaN(height) || isNaN(age) || isNaN(activityValue)) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть коректні числові значення.",
        variant: "destructive",
      })
      return
    }

    console.log("Calculating nutrition with:", { weight, height, age, gender, activityValue })

    const result = calculateNutrition(weight, height, age, gender, activityValue)
    console.log("Calculation result:", result)

    setCalculationResult(result)

    toast({
      title: "Результати",
      description: `Калорії: ${result.calories} кал, Білки: ${result.proteins}г, Жири: ${result.fats}г, Углеводи: ${result.carbs}г`,
    })

    setActiveTab("tracking")
  }

  const handleSaveDaily = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()

  const form = e.currentTarget //

  if (!user) {
    toast({
      title: "Помилка",
      description: "Ви повинні увійти в систему, щоб зберегти дані",
      variant: "destructive",
    })
    return
  }

  if (hasEntryToday) {
    toast({
      title: "Обмеження",
      description: "Ви вже зберегли дані на сьогодні. Можна зробити лише один запис на день",
      variant: "destructive",
    })
    return
  }

  const formData = new FormData(form)
  const calories = Number.parseInt(formData.get("calories") as string)
  const proteins = Number.parseInt(formData.get("proteins") as string)
  const fats = Number.parseInt(formData.get("fats") as string)
  const carbs = Number.parseInt(formData.get("carbs") as string)
  const water = Number.parseInt(formData.get("water") as string)
  const limitExceeded = formData.get("limitExceeded") === "on"

  const now = new Date(currentDate)
  const dateStr = now.toISOString().split("T")[0]
  const entryId = dateStr

  const dailyData = {
    calories,
    proteins,
    fats,
    carbs,
    water,
    limitExceeded,
    timestamp: now.toISOString(),
    date: dateStr,
  }

  try {
    await setDoc(doc(db, "users", user.uid, "daily", entryId), dailyData)

    const userDocRef = doc(db, "users", user.uid)
    const userDoc = await getDoc(userDocRef)
    const userData = userDoc.data()

    let streak = userData?.streak || 0
    const lastDate = userData?.last_date || ""

    const lastDateObj = lastDate ? new Date(lastDate) : null
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isConsecutiveDay =
      lastDateObj &&
      lastDateObj.getFullYear() === yesterday.getFullYear() &&
      lastDateObj.getMonth() === yesterday.getMonth() &&
      lastDateObj.getDate() === yesterday.getDate()

    if (!limitExceeded) {
      if (isConsecutiveDay || !lastDate) {
        streak += 1
      } else if (lastDate !== dateStr) {
        streak = 1
      }
      await setDoc(userDocRef, { ...userData, streak, last_date: dateStr }, { merge: true })
    } else {
      await setDoc(userDocRef, { ...userData, streak: 0, last_date: dateStr }, { merge: true })
      streak = 0
    }

    toast({
      title: "Успіх",
      description: `Дані успішно збережено. Поточна серія: ${streak} днів`,
    })

    form.reset() //
    setCalculationResult(null)
    setHasEntryToday(true)

    fetchHistory(user.uid)
    fetchUserProfile(user.uid)
    setActiveTab("statistics")
  } catch (error) {
    console.error("Error saving daily data:", error)
    toast({
      title: "Помилка",
      description: "Не вдалося зберегти щоденні дані",
      variant: "destructive",
    })
  }
}

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return

    try {
      await deleteDoc(doc(db, "users", user.uid, "daily", entryId))

      toast({
        title: "Успіх",
        description: "Запис успішно видалено",
      })

      fetchHistory(user.uid)

      const today = currentDate.toISOString().split("T")[0]
      if (entryId === today) {
        setHasEntryToday(false)
      }

      updateStreakAfterDelete(user.uid)
    } catch (error) {
      console.error("Error deleting entry:", error)
      toast({
        title: "Помилка",
        description: "Не вдалось видалити запис",
        variant: "destructive",
      })
    }
  }

  const updateStreakAfterDelete = async (uid: string) => {
    try {
      const dailyRef = collection(db, "users", uid, "daily")
      const q = query(dailyRef, orderBy("date", "desc"))
      const querySnapshot = await getDocs(q)

      const entries: any[] = []
      querySnapshot.forEach((doc) => {
        entries.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      let streak = 0
      let lastDate: Date | null = null

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        if (entry.limitExceeded) break //

        const entryDate = new Date(entry.date)

        if (!lastDate) {
          lastDate = entryDate
          streak = 1
          continue
        }

        const expectedDate = new Date(lastDate)
        expectedDate.setDate(expectedDate.getDate() - 1)

        if (
          entryDate.getFullYear() === expectedDate.getFullYear() &&
          entryDate.getMonth() === expectedDate.getMonth() &&
          entryDate.getDate() === expectedDate.getDate()
        ) {
          streak++
          lastDate = entryDate
        } else {
          break //
        }
      }

      const userDocRef = doc(db, "users", uid)
      const userDoc = await getDoc(userDocRef)
      const userData = userDoc.data()

      const lastDateStr = entries.length > 0 ? entries[0].date : ""

      await setDoc(
        userDocRef,
        {
          ...userData,
          streak,
          last_date: lastDateStr,
        },
        { merge: true },
      )

      fetchUserProfile(uid)
    } catch (error) {
      console.error("Error updating streak after delete:", error)
    }
  }

  const advanceToNextDay = () => {
    const nextDay = new Date(currentDate)
    nextDay.setDate(nextDay.getDate() + 1)
    setCurrentDate(nextDay)

    toast({
      title: "Тестовий режим",
      description: `Дата змінена на ${nextDay.toLocaleDateString()}`,
    })

    if (user) {
      checkTodayEntry(user.uid)
    }
  }

  const handleFoodAnalysis = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const description = formData.get("description") as string

    setFoodAnalysisLoading(true)
    setFoodAnalysisResult("")

    try {
      const response = await analyzeFoodWithOpenAI(description)
      setFoodAnalysisResult(response.result)

      if (user) {
        try {
          await addDoc(collection(db, "users", user.uid, "food_analysis"), {
            description,
            result: response.result,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("Error saving food analysis:", error)
        }
      }
    } catch (error) {
      console.error("Error analyzing food:", error)
      toast({
        title: "Помилка",
        description: "Не вдалося проаналізувати їжу",
        variant: "destructive",
      })
    } finally {
      setFoodAnalysisLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await auth.signOut()
      setUser(null)
      setUserProfile(null)
      setHistoryData([])
      toast({
        title: "Успіх",
        description: "Вихід виконано успішно",
      })
    } catch (error) {
      console.error("Error logging out:", error)
      toast({
        title: "Помилка",
        description: "Не вдалося вийти",
      })
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const navigateToTab = (tabValue: string) => {
    setActiveTab(tabValue)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold">NutriWise</h1>
        {user && (
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <p>
                Ви увійшли як: <span className="font-medium">{userProfile?.name || user.email}</span>
              </p>
              <p>
                Поточна серія: <span className="font-medium">{userProfile?.streak || 0} днів</span>
              </p>
              <p>
                Поточна дата: <span className="font-medium">{currentDate.toLocaleDateString()}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={advanceToNextDay}>
                +1 день
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Вийти
              </Button>
            </div>
          </div>
        )}
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="auth">Аутентифікація</TabsTrigger>
          <TabsTrigger value="nutrition">Розрахунок харчування</TabsTrigger>
          <TabsTrigger value="tracking">Відстеження</TabsTrigger>
          <TabsTrigger value="statistics">Статистика</TabsTrigger>
          <TabsTrigger value="analysis">Аналіз їжі</TabsTrigger>
        </TabsList>

        <TabsContent value="auth">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Реєстрація</CardTitle>
                <CardDescription>Створити новий акаунт</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister}>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Имя</Label>
                      <Input id="name" name="name" placeholder="Введіть ваше ім'я" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input id="register-email" name="email" type="email" placeholder="Введіть ваш email" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="register-password">Пароль</Label>
                      <Input
                        id="register-password"
                        name="password"
                        type="password"
                        placeholder="Введіть ваш пароль"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      Зареєструватись
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Увійти</CardTitle>
                <CardDescription>Увійти в існуючий акаунт</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin}>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" name="email" type="email" placeholder="Введіть ваш email" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="login-password">Пароль</Label>
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        placeholder="Введіть ваш пароль"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      Увійти
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nutrition">
          <Card>
            <CardHeader>
              <CardTitle>Калькулятор харчування</CardTitle>
              <CardDescription>Розрахуйте ваші щоденні потреби в харчуванні</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCalculate}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="weight">Вага (кг)</Label>
                    <Input id="weight" name="weight" type="number" placeholder="Наприклад: 70" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="height">Зріст (см)</Label>
                    <Input id="height" name="height" type="number" placeholder="Наприклад: 175" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="age">Вік</Label>
                    <Input id="age" name="age" type="number" placeholder="Наприклад: 30" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Гендер</Label>
                    <Select name="gender" defaultValue="male">
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Виберіть гендер" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Чоловічий</SelectItem>
                        <SelectItem value="female">Жіночий</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="activity">Рівень активності</Label>
                    <Select name="activity" defaultValue="1.2">
                      <SelectTrigger id="activity">
                        <SelectValue placeholder="Виберіть рівень активності" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.2">Сидячий спосіб життя (мало або зовсім немає фізичних вправ)</SelectItem>
                        <SelectItem value="1.375">Легка активність (легкі вправи 1-3 рази на тиждень)</SelectItem>
                        <SelectItem value="1.55">Помірна активність (помірні вправи 3-5 разів на тиждень)</SelectItem>
                        <SelectItem value="1.725">Висока активність (інтенсивні вправи 6-7 разів на тиждень)</SelectItem>
                        <SelectItem value="1.9">Дуже висока активність (дуже інтенсивні вправи та фізична робота)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="mt-4">
                  Розрахувати
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle>Відстеження щоденних потреб в харчуванні</CardTitle>
              <CardDescription>Відстежуйте ваше щоденне споживання поживних речовин</CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <div className="text-center p-4">
                  <p className="mb-4">Вам потрібно увійти в систему, щоб відстежувати харчування</p>
                  <Button onClick={() => navigateToTab("auth")}>Перейти к входу</Button>
                </div>
              ) : hasEntryToday ? (
                <div className="text-center p-4">
                  <p className="mb-4">Ви вже зберегли дані на сьогодні ({currentDate.toLocaleDateString()})</p>
                  <p className="mb-4">Можна зробити тільки один запис на день</p>
                  <div className="flex justify-center gap-4">
                    <Button onClick={() => navigateToTab("statistics")}>Перейти до статистики</Button>
                    <Button variant="outline" onClick={advanceToNextDay}>
                      Перейти на наступний день
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveDaily}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="calories">Калорії</Label>
                      <Input
                        id="calories"
                        name="calories"
                        type="number"
                        placeholder="Наприклад: 2000"
                        defaultValue={calculationResult?.calories || ""}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="proteins">Білки (г)</Label>
                      <Input
                        id="proteins"
                        name="proteins"
                        type="number"
                        placeholder="Наприклад: 150"
                        defaultValue={calculationResult?.proteins || ""}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="fats">Жири (г)</Label>
                      <Input
                        id="fats"
                        name="fats"
                        type="number"
                        placeholder="Наприклад: 70"
                        defaultValue={calculationResult?.fats || ""}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="carbs">Вуглеводи (г)</Label>
                      <Input
                        id="carbs"
                        name="carbs"
                        type="number"
                        placeholder="Наприклад: 200"
                        defaultValue={calculationResult?.carbs || ""}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="water">Вода (мл)</Label>
                      <Input id="water" name="water" type="number" placeholder="Наприклад: 2000" required />
                    </div>
                    <div className="flex items-center space-x-2 self-end">
                      <Checkbox id="limitExceeded" name="limitExceeded" />
                      <Label htmlFor="limitExceeded">Перевищено ліміт калорій</Label>
                    </div>
                  </div>
                  <Button type="submit" className="mt-4">
                    Зберегти дані
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle>Статистика харчування</CardTitle>
              <CardDescription>Перегляд історії харчування та тенденцій</CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <div className="text-center p-4">
                  <p className="mb-4">Ви повинні увійти в систему, щоб переглядати статистику</p>
                  <Button onClick={() => navigateToTab("auth")}>Перейти к входу</Button>
                </div>
              ) : (
                <StatisticsDashboard
                  historyData={historyData}
                  userProfile={userProfile}
                  onDeleteEntry={handleDeleteEntry}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Аналіз харчування</CardTitle>
              <CardDescription>Аналіз харчової цінності продуктів</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFoodAnalysis}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="description">Опис їжі</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Наприклад: 100г курячої грудки з 1 склянкою рису та овочами"
                      rows={4}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={foodAnalysisLoading}>
                    {foodAnalysisLoading ? "Аналіз..." : "Аналіз їжі"}
                  </Button>
                </div>
              </form>

              {foodAnalysisResult && (
                <div className="mt-6 p-4 bg-muted rounded-md">
                  <h3 className="font-medium mb-2">Результати аналіза:</h3>
                  <pre className="whitespace-pre-wrap text-sm">{foodAnalysisResult}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
