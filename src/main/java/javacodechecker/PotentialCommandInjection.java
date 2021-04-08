package javacodechecker;

import java.io.IOException;

public class PotentialCommandInjection {

	@GET
	@Path("/images/{image}")
	@Produces("images/*")
	public void method(@javax.ws.rs.PathParam("image") String image) throws IOException {
		Runtime r = Runtime.getRuntime();

		// EMB-ISSUE: CodeIssueNames.POTENTIAL_COMMAND_INJECTION
		r.exec("/bin/sh -c some_tool" + image);


		String rdpFilePath = myObject.getRdpFilePath();
		ProcessBuilder processBuilder = new ProcessBuilder();
		// EMB-ISSUE: CodeIssueNames.POTENTIAL_COMMAND_INJECTION
		processBuilder.command("mstsc", image).start();
	}
}
