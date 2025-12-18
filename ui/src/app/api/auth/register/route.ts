// src/app/api/auth/register/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db"; // Impor prisma client kita

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // 1. Cek apakah input ada
    if (!name || !email || !password) {
      return new NextResponse("Data tidak lengkap", { status: 400 });
    }

    // 2. Cek apakah email sudah terdaftar
    const existingUser = await db.user.findUnique({
      where: {
        Email: email,
      },
    });

    if (existingUser) {
      return new NextResponse("Email sudah terdaftar", { status: 409 });
    }

    // 3. Enkripsi/Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Buat user baru di database
    const user = await db.user.create({
      data: {
        Name: name,
        Email: email,
        Password: hashedPassword, // Sesuai skema, 'P' besar
        Role: "user", // Sesuai skema, 'R' besar
      },
    });

    return NextResponse.json(user, { status: 201 }); // 201 = Created
  } catch (error) {
    console.log("[REGISTER_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}