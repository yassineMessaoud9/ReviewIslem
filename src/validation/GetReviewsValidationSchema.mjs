export default {
    placeID: {
        in: ["query"],
        isString: {
            errorMessage: "Must be a string.",
        },
        notEmpty: {
            errorMessage: "Must be not empty",
        },
    },
};
