import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import httpStatus from "http-status";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {

    const currentUser = await prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            image_public_id: true,
            imageUrl: true
        }
    })

	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},
					async (error, result) => {
						if (error) {
							console.log(error);
							return reject(error);
						}
						if (!result) {
							return reject(new AppError(httpStatus.INTERNAL_SERVER_ERROR, "No result returned form cloudinary!"));
						}
						resolve(result);
					},
				)
				.end(buffer);
		},
	);
	const updateUser = await prisma.user.update({
		where: { id: userId },
		data: {
			imageUrl: cloudinaryResult?.secure_url,
			image_public_id: cloudinaryResult?.public_id,
		},

		omit: {
			password: true,
		},
	});

    if(currentUser?.imageUrl && currentUser?.image_public_id){
        await cloudinary.uploader.destroy(currentUser.image_public_id)
    }

	return updateUser;
};

export const userService = {
	uploadProfileImage,
};
