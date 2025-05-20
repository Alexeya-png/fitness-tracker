const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY

export async function analyzeFoodWithOpenAI(description: string, mealTime?: string) {
  try {
    const response = await fetch("/api/analyze-food", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description, mealTime }),
    })

    if (!response.ok) {
      throw new Error("Failed to analyze food")
    }

    return await response.json()
  } catch (error) {
    console.error("Error analyzing food:", error)
    return {
      result: `Анализ для ${description}:\nКалорії: 350 ккал\nБілки: 25 г\nЖири: 12 г\nВуглеводи: 35 г\n(Тестові дані)`,
    }
  }
}
