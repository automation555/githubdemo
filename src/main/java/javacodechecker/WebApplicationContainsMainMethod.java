package javacodechecker;

import java.io.IOException;

public class WebApplicationContainsMainMethod extends HttpServlet {

	  public void doGet(HttpServletRequest req, HttpServletResponse res) throws ServletException, IOException {
		    if (userIsAuthorized(req)) {
		      updatePrices(req);
		    }
		  }

		// EMB-ISSUE: CodeIssueNames.WEB_APPLICATION_CONTAINS_MAIN_METHOD
		  public static void main(String[] args) { // Noncompliant
		    updatePrices(req);
		  }
}
