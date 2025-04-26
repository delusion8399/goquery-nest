import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { DatabaseService } from "src/database/database.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import config from "src/configuration";

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly ds: DatabaseService,
    private readonly jwtService: JwtService
  ) {}

  async signup(signupDto: SignupDto) {
    // Check if user already exists
    const existingUser = await this.ds.userModel.findOne({
      email: signupDto.email,
    });

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      signupDto.password,
      config.saltWorkFactor || 10
    );

    // Create new user
    const newUser = await this.ds.userModel.create({
      email: signupDto.email,
      passwordHash,
      name: signupDto.name,
    });

    // Generate JWT token
    const token = this.generateToken(newUser._id.toString());

    return {
      token,
      user: newUser,
    };
  }

  async login(loginDto: LoginDto) {
    // Find user by email
    const user = await this.ds.userModel.findOne({
      email: loginDto.email,
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Generate JWT token
    const token = this.generateToken(user._id.toString());

    return {
      token,
      user: user,
    };
  }

  async getMe(userId: string) {
    const user = await this.ds.userModel.findById(userId);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  private generateToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload);
  }
}
