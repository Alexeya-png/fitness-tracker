import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY відсутній!" }, { status: 500 });
  }

  try {
    const { description } = await request.json();

    if (!description) {
      return NextResponse.json({ error: "Опис страви є обовʼязковим" }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `Порахуй калорійність та БЖВ (білки, жири, вуглеводи) для: ${description}. Відповідай українською мовою.`,
        },
      ],
      max_tokens: 100,
    });

    const result = response.choices[0].message.content;

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("OpenAI API error:", error?.message || error);

    let desc = "";
    try {
      const body = await request.json();
      desc = body.description;
    } catch {}

    return NextResponse.json(
      {
        result: `Аналіз для ${desc || "невідомо"}:\nКалорії: 350 ккал\nБілки: 25 г\nЖири: 12 г\nВуглеводи: 35 г\n(Тестові дані)`,
      },
      { status: 200 }
    );
  }
}
