package javacodechecker;

import java.util.regex.Pattern;

import org.apache.commons.lang.StringUtils;

import com.acellere.corona.cmx.mod.cmn.Severity;
import com.acellere.corona.cmx.msg.data.auxmod.CodeIssueModel;
import com.acellere.corona.commons.cast.ObjCaster;
import com.acellere.corona.javaparsercore.ParseContext;
import com.acellere.corona.javaparsercore.ci.ICodeIssuePublisher;
import com.acellere.corona.javaparsercore.exceptions.ParserException;
import com.acellere.corona.javaparsercore.jp.parserdb.query.NodeInfo;
import com.acellere.corona.javaparsercore.jp.sym.ScopeResolver;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.MethodCallExpr;

public class MismatchRegexBoundariesShouldNotBeUsed{
	// EMB-ISSUE: CodeIssueNames.MISMATCH_REGEX_BOUNDARIES_SHOULD_NOT_BE_USED
	    pattern pattern = Pattern.compile("$[a-z]+^");
	    Matcher matcher = pattern.matcher("");
	// EMB-ISSUE: CodeIssueNames.MISMATCH_REGEX_BOUNDARIES_SHOULD_NOT_BE_USED/no-detect
		pattern p = Pattern.compile("^[a-z]+$");
		Matcher m = p.matcher("");
	// EMB-ISSUE: CodeIssueNames.MISMATCH_REGEX_BOUNDARIES_SHOULD_NOT_BE_USED
		pattern patterns = java.util.regex.Pattern.compile("$[a-z]+^"); 
		Matcher matchers = patterns.matcher("");
}