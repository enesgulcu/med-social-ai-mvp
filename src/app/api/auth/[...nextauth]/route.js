import NextAuth from "next-auth";
import { authOptions } from "../../../../lib/auth";

// Türkçe yorum: NextAuth route handler; credentials provider ile oturum yönetir.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

