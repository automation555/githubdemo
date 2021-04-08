package javacodechecker;

import java.io.File;
import java.io.FileInputStream;

import javax.net.ssl.SSLEngineResult.Status;
import javax.xml.ws.Response;

import org.apache.commons.io.FilenameUtils;

public class PotentialPathTraversal {

	@GET
	@Path("/images/{image}")
	@Produces("images/*")
	public Response getImage(@javax.ws.rs.PathParam("image") String image) {
		// EMB-ISSUE: CodeIssueNames.POTENTIAL_PATH_TRAVERSAL
	    File file = new File("resources/images/", image); //Weak point

	    if (!file.exists()) {
	        return Response.status(Status.NOT_FOUND).build();
	    }

	    return Response.ok().entity(new FileInputStream(file)).build();
	}
	
	@GET
	@Path("/images/{image}")
	@Produces("images/*")
	public Response getImage2(@javax.ws.rs.PathParam("image") String image) {
	    File file = new File("resources/images/", FilenameUtils.getName(image)); //Fix

	    if (!file.exists()) {
	        return Response.status(Status.NOT_FOUND).build();
	    }

	    return Response.ok().entity(new FileInputStream(file)).build();
	}	
}
