import { storage } from "./storage";
import { hashPassword } from "./auth";

async function seedAdmin() {
  try {
    // Check if admin already exists
    const existing = await storage.getAdminUserByUsername("admin");
    
    if (existing) {
      console.log("Admin user already exists");
      return;
    }

    // Create default admin user
    const hashedPassword = await hashPassword("admin123");
    
    const admin = await storage.createAdminUser({
      username: "admin",
      password: hashedPassword,
    });

    console.log("✅ Admin user created successfully");
    console.log("Username: admin");
    console.log("Password: admin123");
    console.log("\n⚠️  Please change the password after first login");
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin user:", error);
    process.exit(1);
  }
}

seedAdmin();
