"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catchAsync = void 0;
const catchAsync = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        }
        catch (error) {
            // console.log(error);
            // res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            //     success: false,
            //     statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            //     message: "Failed to register user",
            //     error: (error as Error).message
            // })
            next(error);
        }
    };
};
exports.catchAsync = catchAsync;
