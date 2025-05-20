// Utility functions for nutrition calculations

export function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  console.log("Calculating BMR with:", { weight, height, age, gender })

  if (gender === "male") {
    return 88.36 + 13.4 * weight + 4.8 * height - 5.7 * age
  } else {
    return 447.6 + 9.2 * weight + 3.1 * height - 4.3 * age
  }
}

export function calculateNutrition(weight: number, height: number, age: number, gender: string, activity: number) {
  console.log("Input values:", { weight, height, age, gender, activity })

  if (isNaN(weight) || isNaN(height) || isNaN(age) || isNaN(activity)) {
    console.error("Invalid input values:", { weight, height, age, gender, activity })
    return {
      calories: 0,
      proteins: 0,
      fats: 0,
      carbs: 0,
    }
  }

  const bmr = calculateBMR(weight, height, age, gender)
  console.log("BMR:", bmr)

  const calories = Math.round(bmr * activity)
  const proteins = Math.round(weight * 1.5)
  const fats = Math.round(weight * 1)
  const carbs = Math.round((calories - (proteins * 4 + fats * 9)) / 4)

  console.log("Calculated values:", { calories, proteins, fats, carbs })

  return {
    calories: calories,
    proteins: proteins,
    fats: fats,
    carbs: Math.max(0, carbs),
  }
}
