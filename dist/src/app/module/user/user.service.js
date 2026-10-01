"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const cloudinary_1 = require("../../lib/cloudinary");
const prisma_1 = require("../../lib/prisma");
const appError_1 = require("../../utils/appError");
const http_status_1 = __importDefault(require("http-status"));
const uploadProfileImage = async (buffer, userId) => {
    const currentUser = await prisma_1.prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            image_public_id: true,
            imageUrl: true
        }
    });
    const cloudinaryResult = await new Promise((resolve, reject) => {
        cloudinary_1.cloudinary.uploader
            .upload_stream({
            resource_type: "auto",
        }, async (error, result) => {
            if (error) {
                console.log(error);
                return reject(error);
            }
            if (!result) {
                return reject(new appError_1.AppError(http_status_1.default.INTERNAL_SERVER_ERROR, "No result returned form cloudinary!"));
            }
            resolve(result);
        })
            .end(buffer);
    });
    const updateUser = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            imageUrl: cloudinaryResult?.secure_url,
            image_public_id: cloudinaryResult?.public_id,
        },
        omit: {
            password: true,
        },
    });
    if (currentUser?.imageUrl && currentUser?.image_public_id) {
        await cloudinary_1.cloudinary.uploader.destroy(currentUser.image_public_id);
    }
    return updateUser;
};
exports.userService = {
    uploadProfileImage,
};
