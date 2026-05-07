import { db } from "../db";
import {
  conversations, messages, users,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
} from "@shared/schema";
import { eq, and, sql, desc, asc, inArray, count } from "drizzle-orm";

export const messagingStorage = {
  async getOrCreateConversation(seekerId: number, employerId: number, jobId?: number | null): Promise<Conversation> {
    const existing = await db.select().from(conversations)
      .where(
        jobId
          ? and(eq(conversations.seekerId, seekerId), eq(conversations.employerId, employerId), eq(conversations.jobId, jobId))
          : and(eq(conversations.seekerId, seekerId), eq(conversations.employerId, employerId), sql`${conversations.jobId} IS NULL`)
      )
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [conv] = await db.insert(conversations)
      .values({ seekerId, employerId, jobId: jobId ?? null } as any)
      .returning();
    return conv;
  },

  async getConversations(userId: number): Promise<(Conversation & { otherPartyName: string; lastMessage: string | null; unreadCount: number })[]> {
    const convs = await db.select().from(conversations)
      .where(sql`${conversations.seekerId} = ${userId} OR ${conversations.employerId} = ${userId}`)
      .orderBy(desc(conversations.lastMessageAt));

    const results = await Promise.all(convs.map(async (conv) => {
      const otherUserId = conv.seekerId === userId ? conv.employerId : conv.seekerId;
      const [otherUser] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        companyName: users.companyName,
      }).from(users).where(eq(users.id, otherUserId)).limit(1);

      const otherPartyName = otherUser
        ? (otherUser.firstName && otherUser.lastName
          ? `${otherUser.firstName} ${otherUser.lastName}`
          : otherUser.companyName || otherUser.email)
        : "Unknown";

      const lastMsgs = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const [unreadResult] = await db.select({ cnt: count() }).from(messages)
        .where(and(
          eq(messages.conversationId, conv.id),
          eq(messages.isRead, false),
          sql`${messages.senderId} != ${userId}`
        ));

      return {
        ...conv,
        otherPartyName: otherPartyName as string,
        lastMessage: lastMsgs[0]?.content ?? null,
        unreadCount: Number(unreadResult?.cnt ?? 0),
      };
    }));
    return results;
  },

  async getMessages(conversationId: number): Promise<Message[]> {
    return db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  },

  async createMessage(conversationId: number, senderId: number, content: string): Promise<Message> {
    const [msg] = await db.insert(messages)
      .values({ conversationId, senderId, content, isRead: false } as any)
      .returning();
    await db.update(conversations)
      .set({ lastMessageAt: new Date() } as any)
      .where(eq(conversations.id, conversationId));
    return msg;
  },

  async markConversationRead(conversationId: number, userId: number): Promise<void> {
    await db.update(messages)
      .set({ isRead: true } as any)
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.isRead, false),
        sql`${messages.senderId} != ${userId}`
      ));
  },

  async getUnreadMessageCount(userId: number): Promise<number> {
    const userConvs = await db.select({ id: conversations.id }).from(conversations)
      .where(sql`${conversations.seekerId} = ${userId} OR ${conversations.employerId} = ${userId}`);
    if (userConvs.length === 0) return 0;
    const convIds = userConvs.map((c) => c.id);
    const [result] = await db.select({ cnt: count() }).from(messages)
      .where(and(
        inArray(messages.conversationId, convIds),
        eq(messages.isRead, false),
        sql`${messages.senderId} != ${userId}`
      ));
    return Number(result?.cnt ?? 0);
  },

  async getConversationUnreadCount(conversationId: number, recipientId: number): Promise<number> {
    const [result] = await db.select({ cnt: count() }).from(messages)
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.isRead, false),
        sql`${messages.senderId} != ${recipientId}`
      ));
    return Number(result?.cnt ?? 0);
  },

  async getConversation(conversationId: number): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    return conv;
  },
};
