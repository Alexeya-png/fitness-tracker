// OpenAI service for food analysis
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY

export async function analyzeFoodWithOpenAI(description: string) {
  try {
    const response = await fetch("/api/analyze-food", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    })

    if (!response.ok) {
      throw new Error("Failed to analyze food")
    }

    return await response.json()
  } catch (error) {
    console.error("Error analyzing food:", error)
    // Fallback response if API call fails
    return {
      result: `Анализ для ${description}:\nКалории: 350 ккал\nБелки: 25г\nЖиры: 12г\nУглеводы: 35г\n(Тестовые данные)`,
    }
  }
}
