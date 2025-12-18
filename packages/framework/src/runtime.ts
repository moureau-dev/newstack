/**
 * @description
 * Runtime module for handling server function invocations from the client.
 * This module provides a centralized way to call server-side static methods
 * from client-side code through HTTP requests.
 */

export const runtime = {
  /**
   * @description
   * Invokes a server-side static method by making a POST request to the server.
   * The server will execute the actual method and return the result.
   *
   * @param methodName The name of the static method to invoke
   * @param hash The unique hash identifying the component class
   * @param params The parameters to pass to the server method
   * @returns A promise that resolves with the method's result
   * @throws Error if the server returns an error
   */
  async invoke(methodName: string, hash: string, params: any): Promise<any> {
    const body = { ...params };
    if (body && typeof body === "object") {
      // biome-ignore lint/performance/noDelete: <explanation>
      delete body.deps;
    }

    const url = `/api/newstack/${hash}/${methodName}`;
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    };

    const response = await fetch(url, options);
    const { result, error } = await response.json();

    if (error) throw new Error(error);
    return result;
  },
};
