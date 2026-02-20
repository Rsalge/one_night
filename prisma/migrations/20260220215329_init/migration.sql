-- CreateTable
CREATE TABLE "Game" (
    "roomCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "selectedRoles" JSONB,
    "centerRoles" JSONB,
    "nightIndex" INTEGER NOT NULL DEFAULT 0,
    "nightLog" JSONB,
    "shielded" JSONB,
    "revealed" JSONB,
    "votes" JSONB,
    "pendingAcks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("roomCode")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "originalRole" TEXT,
    "disconnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("roomCode") ON DELETE CASCADE ON UPDATE CASCADE;
