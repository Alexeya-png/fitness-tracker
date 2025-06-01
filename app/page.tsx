"use client"

import type React from "react"
import { AnalysisForm } from "@/components/analysis-form" // Изменено на именованный импорт

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  const [calculationResult, setCalculationResult] = useState<any>(null) // Only for nutrition calculator
  const [trackingFormData, setTrackingFormData] = useState<any>(null) // For pre-filling tracking form
  const [mounted, setMounted] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Изменим функцию checkTodayEntry, чтобы она правильно определяла наличие всех приемов пищи
  const checkTodayEntry = async (uid: string) => {
    if (!mounted) return

    try {
      const today = currentDate.toISOString().split("T")[0]
      const dailyRef = collection(db, "users", uid, "daily")
      const q = query(dailyRef, where("date", "==", today))

      const querySnapshot = await getDocs(q)
      const entries = querySnapshot.docs.map((doc) => doc.data())

      // Проверяем, есть ли записи для всех приемов пищи
      const hasMorning = entries.some((entry) => entry.mealTime === "morning")
      const hasAfternoon = entries.some((entry) => entry.mealTime === "afternoon")
      const hasEvening = entries.some((entry) => entry.mealTime === "evening")

      // Если есть все три приема пищи, устанавливаем флаг и переходим на вкладку статистики
      if (hasMorning && hasAfternoon && hasEvening) {
        setHasEntryToday(true)
        setActiveTab("tracking") // Переходим на вкладку отслеживания, чтобы показать сообщение
      } else {
        setHasEntryToday(false)
      }
    } catch (error) {
      console.error("Error checking today entry:", error)
      setHasEntryToday(false) // В случае ошибки сбрасываем флаг
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

    // Set calculation result to show "Ваша норма" card
    setCalculationResult(result)

    // Also set tracking form data for pre-filling
    setTrackingFormData(result)

    toast({
      title: "Результати",
      description: `Калорії: ${result.calories} кал, Білки: ${result.proteins}г, Жири: ${result.fats}г, Углеводи: ${result.carbs}г`,
    })

    setActiveTab("tracking")
  }

  // Изменим функцию handleSaveDaily, чтобы после сохранения последнего приема пищи переходить на вкладку отслеживания
  const handleSaveDaily = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const form = e.currentTarget

    // Заменим русские строки на украинские в интерфейсе

    // Заменим строки в форме отслеживания
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

    // Заменим сообщения об ошибках и успехе
    if (!user) {
      toast({
        title: "Помилка",
        description: "Ви повинні увійти в систему, щоб зберегти дані",
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
    const mealTime = (formData.get("mealTime") as string) || trackingFormData?.mealTime || "morning"
    const limitExceeded = formData.get("limitExceeded") === "on"

    const now = new Date(currentDate)
    const dateStr = now.toISOString().split("T")[0]
    const entryId = `${dateStr}_${mealTime}`

    // Проверяем, есть ли уже запись за этот день и время приема пищи
    try {
      const docRef = doc(db, "users", user.uid, "daily", entryId)
      const docSnap = await getDoc(docRef)

      // Заменим сообщение о существующей записи
      if (docSnap.exists()) {
        toast({
          title: "Запис вже існує",
          description: `Ви вже зберегли дані на ${currentDate.toLocaleDateString()} (${getMealTimeName(mealTime)})`,
          variant: "destructive",
        })
        return
      }

      const dailyData = {
        calories,
        proteins,
        fats,
        carbs,
        water,
        limitExceeded,
        timestamp: now.toISOString(),
        date: dateStr,
        mealTime,
        mealTimeName: getMealTimeName(mealTime),
      }

      await setDoc(doc(db, "users", user.uid, "daily", entryId), dailyData)

      // Обновляем серию только если это последний прием пищи (вечер)
      // или если это единственный прием пищи за день
      // или если это единственный прием пищи за день
      if (mealTime === "evening" || !(await hasMealForDay(user.uid, dateStr, ["morning", "afternoon"]))) {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)
        const userData = userDoc.data()

        let streak = userData?.streak || 0
        const lastDate = userData?.last_date || ""

        const lastDateObj = lastDate ? new Date(lastDate) : null
        const currentDateObj = new Date(now)

        // Проверяем, является ли текущая дата следующим днем после последней записи
        let isConsecutiveDay = false

        if (lastDateObj) {
          // Создаем объекты дат без времени для корректного сравнения
          const lastDateOnly = new Date(lastDateObj.getFullYear(), lastDateObj.getMonth(), lastDateObj.getDate())
          const currentDateOnly = new Date(
            currentDateObj.getFullYear(),
            currentDateObj.getMonth(),
            currentDateObj.getDate(),
          )

          // Вычисляем разницу в днях между датами
          const timeDiff = currentDateOnly.getTime() - lastDateOnly.getTime()
          const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24))

          // Если разница ровно 1 день, то это последовательный день
          isConsecutiveDay = daysDiff === 1

          // Если разница больше 1 дня, значит пользователь пропустил день(и) и серия должна сброситься
          if (daysDiff > 1) {
            streak = 0
          }
        }

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
      }

      // Заменим сообщение об успешном сохранении
      toast({
        title: "Успіх",
        description: `Дані успішно збережені для ${getMealTimeName(mealTime)}`,
      })

      form.reset()
      // Clear both tracking form data and calculation result after saving
      setTrackingFormData(null)
      setCalculationResult(null)
      fetchHistory(user.uid)
      fetchUserProfile(user.uid)

      // Проверяем, заполнены ли все приемы пищи за день
      await checkTodayEntry(user.uid)
    } catch (error) {
      console.error("Error saving daily data:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить данные",
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

  // Изменим функцию advanceToNextDay, чтобы она корректно сбрасывала флаг hasEntryToday
  // и ��роверяла наличие записей в новом дне

  const advanceToNextDay = async () => {
    if (!mounted) return

    const nextDay = new Date(currentDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // Сначала проверяем, были ли записи за текущий день перед переходом на следующий
    if (user) {
      const currentDateStr = currentDate.toISOString().split("T")[0]
      const hasAnyMealToday = await checkAnyMealForDay(user.uid, currentDateStr)

      if (!hasAnyMealToday) {
        // Если записей не было, сбрасываем серию
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)
        const userData = userDoc.data()

        await setDoc(
          userDocRef,
          {
            ...userData,
            streak: 0,
            last_date: currentDateStr,
          },
          { merge: true },
        )

        // Обновляем данные профиля пользователя
        fetchUserProfile(user.uid)

        toast({
          title: "Серія скинута",
          description: "Ви не зробили жодного запису за поточний день, серія скинута до 0",
          variant: "destructive",
        })
      }
    }

    // Теперь устанавливаем новую дату
    setCurrentDate(nextDay)

    // Важно: сразу сбрасываем флаг hasEntryToday, чтобы пользователь мог заполнить новый день
    setHasEntryToday(false)

    toast({
      title: "Тестовий режим",
      description: `Дата змінена на ${nextDay.toLocaleDateString()}`,
    })

    // Проверяем наличие записей в новом дне
    if (user) {
      const nextDayStr = nextDay.toISOString().split("T")[0]
      const dailyRef = collection(db, "users", user.uid, "daily")
      const q = query(dailyRef, where("date", "==", nextDayStr))

      const querySnapshot = await getDocs(q)
      const entries = querySnapshot.docs.map((doc) => doc.data())

      // Проверяем, есть ли записи для всех приемов пищи в новом дне
      const hasMorning = entries.some((entry) => entry.mealTime === "morning")
      const hasAfternoon = entries.some((entry) => entry.mealTime === "afternoon")
      const hasEvening = entries.some((entry) => entry.mealTime === "evening")

      // Устанавливаем флаг hasEntryToday только если есть все три приема пищи
      if (hasMorning && hasAfternoon && hasEvening) {
        setHasEntryToday(true)
      } else {
        // Если не все приемы пищи заполнены, переходим на вкладку отслеживания
        setActiveTab("tracking")
      }
    }
  }

  // Функция для проверки наличия любых записей за день
  const checkAnyMealForDay = async (uid: string, date: string): Promise<boolean> => {
    try {
      const dailyRef = collection(db, "users", uid, "daily")
      const q = query(dailyRef, where("date", "==", date))
      const querySnapshot = await getDocs(q)
      return !querySnapshot.empty
    } catch (error) {
      console.error("Error checking meals for day:", error)
      return false
    }
  }

  // Функция для анализа еды и заполнения формы отслеживания
  const handleAnalyzeFood = async (description: string, mealTime: string) => {
    setFoodAnalysisLoading(true)
    setFoodAnalysisResult("")

    try {
      const response = await analyzeFoodWithOpenAI(description, mealTime)
      setFoodAnalysisResult(response.result)

      // Извлекаем данные о питательных веществах из ответа
      const nutritionData = extractNutritionData(response.result, mealTime)

      // Устанавливаем данные ТОЛЬКО для предзаполнения формы отслеживания
      // НЕ устанавливаем calculationResult, чтобы не показывать карточку "Ваша норма"
      setTrackingFormData(nutritionData)

      // Сохраняем анализ в истории, если пользователь авторизован
      if (user) {
        try {
          await addDoc(collection(db, "users", user.uid, "food_analysis"), {
            description,
            result: response.result,
            mealTime,
            nutritionData,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("Error saving food analysis:", error)
        }
      }

      // Переходим на вкладку отслеживания с предзаполненными данными
      setActiveTab("tracking")

      toast({
        title: "Аналіз завершено",
        description: "Дані про поживні речовини додані до форми відстеження",
      })
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

  // Функция для получения названия времени приема пищи
  const hasMealForDay = async (uid: string, date: string, mealTimes: string[]): Promise<boolean> => {
    for (const mealTime of mealTimes) {
      const entryId = `${date}_${mealTime}`
      const docRef = doc(db, "users", uid, "daily", entryId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return true
      }
    }
    return false
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
              {mounted && (
                <p>
                  Поточна дата: <span className="font-medium">{currentDate.toLocaleDateString()}</span>
                </p>
              )}
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
                        <SelectItem value="1.725">
                          Висока активність (інтенсивні вправи 6-7 разів на тиждень)
                        </SelectItem>
                        <SelectItem value="1.9">
                          Дуже висока активність (дуже інтенсивні вправи та фізична робота)
                        </SelectItem>
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
                  <Button onClick={() => navigateToTab("auth")}>Перейти до входу</Button>
                </div>
              ) : hasEntryToday ? (
                <div className="text-center p-4">
                  <p className="mb-4">
                    Ви вже зберегли всі прийоми їжі на сьогодні ({currentDate.toLocaleDateString()})
                  </p>
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
                        defaultValue={trackingFormData?.calories || ""}
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
                        defaultValue={trackingFormData?.proteins || ""}
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
                        defaultValue={trackingFormData?.fats || ""}
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
                        defaultValue={trackingFormData?.carbs || ""}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="water">Вода (мл)</Label>
                      <Input id="water" name="water" type="number" placeholder="Наприклад: 2000" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mealTime">Час прийому їжі</Label>
                      <Select name="mealTime" defaultValue={trackingFormData?.mealTime || "morning"}>
                        <SelectTrigger id="mealTime">
                          <SelectValue placeholder="Виберіть час прийому їжі" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Ранок</SelectItem>
                          <SelectItem value="afternoon">День</SelectItem>
                          <SelectItem value="evening">Вечір</SelectItem>
                        </SelectContent>
                      </Select>
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
          <AnalysisForm onAnalyze={handleAnalyzeFood} isLoading={foodAnalysisLoading} result={foodAnalysisResult} />
        </TabsContent>
      </Tabs>

      {/* "Ваша норма" card only shows when calculationResult is set from nutrition calculator */}
      {calculationResult && (
        <div className="flex justify-center w-full my-6">
          <div className="w-full max-w-2xl">
            <Card className="bg-gradient-to-br from-emerald-900 to-neutral-900 border border-emerald-500/50 rounded-xl shadow-xl overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <CardHeader className="pb-2 border-b border-emerald-500/20">
                <CardTitle className="text-xl text-emerald-300 font-semibold flex items-center gap-2">
                  Ваша норма
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  {[
                    { label: "Калорії", value: calculationResult.calories, unit: "" },
                    { label: "Білки", value: calculationResult.proteins, unit: "г" },
                    { label: "Жири", value: calculationResult.fats, unit: "г" },
                    { label: "Вуглеводи", value: calculationResult.carbs, unit: "г" },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="bg-black/20 rounded-lg p-3 backdrop-blur-sm transform transition-all hover:scale-105"
                    >
                      <div className="text-emerald-300 text-xs uppercase tracking-wider mb-1">{item.label}</div>
                      <div className="text-2xl font-bold text-white flex items-center justify-center">
                        {item.value}
                        <span className="text-sm ml-1 text-emerald-300/80">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-6">
                  <Button
                    variant="outline"
                    className="text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/50 hover:text-emerald-200 transition-all"
                    size="sm"
                    onClick={() => setCalculationResult(null)}
                  >
                    Очистити результат
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  )
}

const extractNutritionData = (text: string, mealTime?: string) => {
  const caloriesMatch = text.match(/калорі[йї]:\s*(\d+)/i) || text.match(/калорі[йї]\s*[-–:]\s*(\d+)/i)
  const proteinsMatch = text.match(/білк[иі]:\s*(\d+)/i) || text.match(/білк[иі]\s*[-–:]\s*(\d+)/i)
  const fatsMatch = text.match(/жир[иі]:\s*(\d+)/i) || text.match(/жир[иі]\s*[-–:]\s*(\d+)/i)
  const carbsMatch = text.match(/вуглевод[иі]:\s*(\d+)/i) || text.match(/вуглевод[иі]\s*[-–:]\s*(\d+)/i)

  const calories = caloriesMatch ? Number.parseInt(caloriesMatch[1]) : 0
  const proteins = proteinsMatch ? Number.parseInt(proteinsMatch[1]) : 0
  const fats = fatsMatch ? Number.parseInt(fatsMatch[1]) : 0
  const carbs = carbsMatch ? Number.parseInt(carbsMatch[1]) : 0

  return {
    calories,
    proteins,
    fats,
    carbs,
    mealTime,
  }
}
