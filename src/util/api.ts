import axios, { AxiosResponse } from "axios";
import { z, ZodError, ZodType } from "zod";

const REQUEST_TIMEOUT_MILLIS = 5000;

export async function apiGet<T>(
    requestUrl: string,
    validationSchema: ZodType<T>,
    headers?: Record<string, string>
): Promise<T> {
    return handleAxiosResponse(
        await axios.get(requestUrl, {
            headers,
            timeout: REQUEST_TIMEOUT_MILLIS,
        }),
        validationSchema
    );
}

export async function apiPost<T>(
    requestUrl: string,
    requestBody: Record<string, any>,
    validationSchema: ZodType<T>,
    headers?: Record<string, string>
): Promise<T> {
    return handleAxiosResponse(
        await axios.post(requestUrl, requestBody, {
            headers,
            timeout: REQUEST_TIMEOUT_MILLIS,
        }),
        validationSchema
    );
}

async function handleAxiosResponse<T>(
    response: AxiosResponse,
    validationSchema: ZodType<T>
): Promise<T> {
    try {
        const responseBody = validationSchema.parse(response.data);
        return responseBody;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const errorMessage =
                error.response?.data?.detail ||
                "The request failed but no error detail was included.";

            throw new Error(errorMessage);
        }

        if (error instanceof ZodError) {
            throw new Error(z.prettifyError(error));
        }

        throw error;
    }
}
