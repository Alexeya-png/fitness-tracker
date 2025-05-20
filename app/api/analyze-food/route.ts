import { OpenAI } from "openai"
import { NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY відсутній!" }, { status: 500 })
  }

  try {
    const { description, mealTime } = await request.json()

    if (!description) {
      return NextResponse.json({ error: "Опис страви є обовʼязковим" }, { status: 400 })
    }

    const prompt = `
    Проаналізуй харчову цінність наступної їжі та обов'язково врахуй вагу, вказану у запиті користувача (наприклад: 1 кг, 500 г, 250 г тощо).
    Якщо вага не вказана — рахуй для 100 г.
    ${description}

    Це прийом їжі: ${mealTime || "Не вказано"}

    Надай точну інформацію про:
    1. Калорії (ккал)
    2. Білки (г)
    3. Жири (г)
    4. Вуглеводи (г)

    Форматуй відповідь ТІЛЬКИ так:
    Калорії: X ккал
    Білки: X г
    Жири: X г
    Вуглеводи: X г

    X — числове значення для зазначеної ваги продукту. Не додавай жодних пояснень або назв.
    `

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.3, // Снижаем температуру для более точных ответов
    })

    const result = response.choices[0].message.content

    return NextResponse.json({ result })
  } catch (error: any) {
    console.error("OpenAI API error:", error?.message || error)

    let desc = ""
    try {
      const body = await request.json()
      desc = body.description
    } catch {}

    return NextResponse.json(
      {
        result: `Аналіз для ${desc || "невідомо"}:\nКалорії: 350 ккал\nБілки: 25 г\nЖири: 12 г\nВуглеводи: 35 г\n(Тестові дані)`,
      },
      { status: 200 },
    )
  }
}
