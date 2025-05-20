"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AnalysisFormProps {
  onAnalyze: (description: string, mealTime: string) => Promise<void>
  isLoading: boolean
  result: string
}

export function AnalysisForm({ onAnalyze, isLoading, result }: AnalysisFormProps) {
  const [description, setDescription] = useState("")
  const [mealTime, setMealTime] = useState("morning")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await onAnalyze(description, mealTime)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Аналіз харчування</CardTitle>
        <CardDescription>Аналіз харчової цінності продуктів</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mealTime">Час прийому їжі</Label>
              <Select value={mealTime} onValueChange={setMealTime}>
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
            <div className="grid gap-2">
              <Label htmlFor="description">Опис їжі</Label>
              <Textarea
                id="description"
                placeholder="Наприклад: 100г курячої грудки з 1 склянкою рису та овочами"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Аналіз..." : "Аналіз їжі"}
            </Button>
          </div>
        </form>

        {result && (
          <div className="mt-6 p-4 bg-muted rounded-md">
            <h3 className="font-medium mb-2">Результати аналіза:</h3>
            <pre className="whitespace-pre-wrap text-sm">{result}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AnalysisForm
