-- CreateTable
CREATE TABLE "User" (
    "User_id" SERIAL NOT NULL,
    "Name" TEXT,
    "Email" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "Role" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("User_id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "Chat_id" SERIAL NOT NULL,
    "Category" TEXT NOT NULL,
    "Question" TEXT NOT NULL,
    "Answer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Feedback" BOOLEAN,
    "User_id" INTEGER NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("Chat_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_Email_key" ON "User"("Email");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_User_id_fkey" FOREIGN KEY ("User_id") REFERENCES "User"("User_id") ON DELETE RESTRICT ON UPDATE CASCADE;
